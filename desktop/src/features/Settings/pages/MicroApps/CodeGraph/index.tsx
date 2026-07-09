import { useEffect, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  FlaskConical,
  FolderCog,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Siren,
  SquareTerminal,
} from "lucide-react";
import Alert from "@/shared/ui/Alert";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import {
  Button,
  IconButton,
  SegmentedTabs,
  Skeleton,
  Switch,
  TextArea,
  TextInput,
} from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import {
  detectCodeGraphStudio,
  getCodeGraphStudioReport,
  healthCodeGraphStudio,
  saveCodeGraphStudioConfig,
  smokeQueryCodeGraphStudio,
  smokeStatusCodeGraphStudio,
  startCodeGraphStudio,
  stopCodeGraphStudio,
  type CodeGraphStudioBlockedReasonCode,
  type CodeGraphStudioReport,
  type CodeGraphStudioSmokeResult,
  type CodeGraphStudioStatus,
} from "@/shared/api/codegraphStudio";

const FAKE_PROVIDER_FIXTURE_SEGMENTS = [
  "src",
  "mcp",
  "managed-codegraph",
  "__tests__",
  "fixtures",
  "fake-codegraph-provider.mjs",
] as const;

type SmokeMode = "real" | "fake";

type CodeGraphDraft = {
  command: string;
  startArgsText: string;
  versionProbeArgsText: string;
  telemetryProbeArgsText: string;
  appDataRoot: string;
  timeoutMs: string;
  maxResults: string;
  queryLimit: string;
  smokeQuery: string;
};

type SummaryReasonCard = {
  key: string;
  title: string;
  description: string;
  badgeLabel: string;
  badgeVariant: "success" | "warning" | "danger" | "muted" | "primary";
  icon: ComponentType<{ className?: string }>;
};

const argsToText = (value: string[]) => value.join("\n");

const textToArgs = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const createDraft = (report: CodeGraphStudioReport): CodeGraphDraft => ({
  command: report.config.command,
  startArgsText: argsToText(report.config.startArgs),
  versionProbeArgsText: argsToText(report.config.versionProbeArgs),
  telemetryProbeArgsText: argsToText(report.config.telemetryProbeArgs),
  appDataRoot: report.config.appDataRoot,
  timeoutMs: String(report.config.timeoutMs),
  maxResults: String(report.config.maxResults),
  queryLimit: String(report.config.queryLimit),
  smokeQuery: "microapps architecture flow overview",
});

const trimTrailingSeparators = (value: string) => value.replace(/[\\/]+$/, "");

const getLastSeparatorIndex = (value: string) =>
  Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));

const getParentPath = (value: string) => {
  const normalized = trimTrailingSeparators(value);
  const separatorIndex = getLastSeparatorIndex(normalized);
  if (separatorIndex <= 0) {
    return normalized;
  }
  return normalized.slice(0, separatorIndex);
};

const getLeafName = (value: string) => {
  const normalized = trimTrailingSeparators(value);
  const separatorIndex = getLastSeparatorIndex(normalized);
  if (separatorIndex === -1) {
    return normalized;
  }
  return normalized.slice(separatorIndex + 1);
};

const joinPathSegments = (basePath: string, ...segments: string[]) => {
  const separator = basePath.includes("\\") ? "\\" : "/";
  const normalizedBase = trimTrailingSeparators(basePath);
  return [normalizedBase, ...segments.filter(Boolean)]
    .join(separator)
    .replace(/[\\/]+/g, separator);
};

const buildRecommendedAppDataRoot = (workspaceRoot: string, currentResolved: string | null) => {
  if (currentResolved?.trim()) {
    return currentResolved;
  }

  const repoRoot = getParentPath(workspaceRoot);
  const outerRoot = getParentPath(repoRoot);
  const repoName = getLeafName(repoRoot) || "uichat-mira";
  const safeBase = outerRoot && outerRoot !== repoRoot ? outerRoot : getParentPath(workspaceRoot);
  return joinPathSegments(safeBase, `${repoName}-codegraph-appdata`);
};

const buildFakeProviderFixturePath = (workspaceRoot: string) =>
  joinPathSegments(workspaceRoot, ...FAKE_PROVIDER_FIXTURE_SEGMENTS);

const buildSavePayload = (draft: CodeGraphDraft) => ({
  command: draft.command.trim(),
  startArgs: textToArgs(draft.startArgsText),
  versionProbeArgs: textToArgs(draft.versionProbeArgsText),
  telemetryProbeArgs: textToArgs(draft.telemetryProbeArgsText),
  appDataRoot: draft.appDataRoot.trim(),
  timeoutMs: Number(draft.timeoutMs),
  maxResults: Number(draft.maxResults),
  queryLimit: Number(draft.queryLimit),
});

const isConfigDirty = (report: CodeGraphStudioReport, draft: CodeGraphDraft) =>
  JSON.stringify(buildSavePayload(draft)) !==
  JSON.stringify({
    command: report.config.command,
    startArgs: report.config.startArgs,
    versionProbeArgs: report.config.versionProbeArgs,
    telemetryProbeArgs: report.config.telemetryProbeArgs,
    appDataRoot: report.config.appDataRoot,
    timeoutMs: report.config.timeoutMs,
    maxResults: report.config.maxResults,
    queryLimit: report.config.queryLimit,
  });

const normalizeReasonCodes = (
  reasons: Array<{ code: CodeGraphStudioBlockedReasonCode }>,
) => new Set(reasons.map((reason) => reason.code));

const toStatusLabel = (status: CodeGraphStudioStatus) =>
  status.charAt(0).toUpperCase() + status.slice(1);

const summarizeSmokePayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = Array.isArray(record.candidates) ? record.candidates.length : null;
  const content = Array.isArray(record.content) ? record.content.length : null;

  return {
    candidates,
    content,
  };
};

export default function CodeGraphStudioPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<CodeGraphStudioReport | null>(null);
  const [draft, setDraft] = useState<CodeGraphDraft | null>(null);
  const [smokeResult, setSmokeResult] = useState<CodeGraphStudioSmokeResult | null>(null);
  const [smokeMode, setSmokeMode] = useState<SmokeMode>("real");
  const [realDraftBackup, setRealDraftBackup] = useState<CodeGraphDraft | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const nextReport = await getCodeGraphStudioReport();
      setReport(nextReport);
      setDraft(createDraft(nextReport));
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.codeGraphStudio.messages.loadFailed"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const persistDraftIfNeeded = async (currentDraft: CodeGraphDraft, currentReport: CodeGraphStudioReport) => {
    if (!isConfigDirty(currentReport, currentDraft)) {
      return currentReport;
    }

    const nextReport = await saveCodeGraphStudioConfig(buildSavePayload(currentDraft));
    setReport(nextReport);
    setDraft(createDraft(nextReport));
    return nextReport;
  };

  const saveConfig = async () => {
    if (!draft) {
      return;
    }

    setSaving(true);
    try {
      const nextReport = await saveCodeGraphStudioConfig(buildSavePayload(draft));
      setReport(nextReport);
      setDraft(createDraft(nextReport));
      message.success(t("settings.microApps.codeGraphStudio.messages.configSaved"));
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.codeGraphStudio.messages.configSaveFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (
    action: "detect" | "start" | "health" | "stop" | "smoke-status" | "smoke-query",
  ) => {
    if (!draft || !report) {
      return;
    }

    setSaving(true);
    try {
      const nextReport =
        action === "stop"
          ? report
          : await persistDraftIfNeeded(draft, report);

      if (action === "detect") {
        const result = await detectCodeGraphStudio();
        setReport(result.report);
        setSmokeResult(null);
        message.success(
          t("settings.microApps.codeGraphStudio.messages.actionExecuted", {
            action: "detect",
          }),
        );
      } else if (action === "start") {
        const result = await startCodeGraphStudio();
        setReport(result.report);
        setSmokeResult(null);
        message.success(
          t("settings.microApps.codeGraphStudio.messages.actionExecuted", {
            action: "start",
          }),
        );
      } else if (action === "health") {
        const result = await healthCodeGraphStudio();
        setReport(result.report);
        setSmokeResult(null);
        message.success(
          t("settings.microApps.codeGraphStudio.messages.actionExecuted", {
            action: "health",
          }),
        );
      } else if (action === "stop") {
        const result = await stopCodeGraphStudio();
        setReport(result.report);
        setSmokeResult(null);
        message.success(
          t("settings.microApps.codeGraphStudio.messages.actionExecuted", {
            action: "stop",
          }),
        );
      } else if (action === "smoke-status") {
        const result = await smokeStatusCodeGraphStudio();
        setSmokeResult(result);
        setReport(result.report);
        setDraft(createDraft(result.report));
      } else {
        const result = await smokeQueryCodeGraphStudio(draft.smokeQuery);
        setSmokeResult(result);
        setReport(result.report);
        setDraft(createDraft(result.report));
      }
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.microApps.codeGraphStudio.messages.actionFailed"),
      );
    } finally {
      setSaving(false);
    }
  };

  const copyDebugReport = async () => {
    if (!report) {
      return;
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      message.success(t("settings.microApps.codeGraphStudio.messages.debugCopied"));
    } catch {
      message.error(t("settings.microApps.codeGraphStudio.messages.debugCopyFailed"));
    }
  };

  if (loading || !report || !draft) {
    return (
      <MicroAppPageLayout
        miniTitle="CodeGraph"
        title={t("settings.microApps.codeGraphStudio.page.title")}
        description={t("settings.microApps.codeGraphStudio.page.description")}
        contentClassName="space-y-4 pt-4"
      >
        <div aria-hidden="true" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_320px]">
            <div className="space-y-4 rounded-ui-panel border border-transparent px-4 py-5">
              <div className="flex items-start gap-4">
                <Skeleton.Circle size={44} />
                <div className="min-w-0 flex-1 space-y-3 pt-1">
                  <Skeleton width="28%" height={34} radius="control" />
                  <Skeleton.Text lines={2} lastLineWidth="70%" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} height={40} radius="panel" />
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-ui-panel border border-transparent px-4 py-5">
              <Skeleton width="34%" height={20} radius="control" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Skeleton.Circle size={24} />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton width="58%" height={14} radius="control" />
                      <Skeleton.Text lines={2} lastLineWidth="74%" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4 rounded-ui-panel border border-transparent px-4 py-4">
              <Skeleton width="24%" height={22} radius="control" />
              <Skeleton height={300} radius="panel" />
            </div>
            <div className="space-y-4 rounded-ui-panel border border-transparent px-4 py-4">
              <Skeleton width="28%" height={22} radius="control" />
              <Skeleton height={300} radius="panel" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4 rounded-ui-panel border border-transparent px-4 py-4">
              <Skeleton width="26%" height={22} radius="control" />
              <Skeleton height={420} radius="panel" />
            </div>
            <div className="space-y-4 rounded-ui-panel border border-transparent px-4 py-4">
              <Skeleton width="24%" height={22} radius="control" />
              <Skeleton height={420} radius="panel" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4 rounded-ui-panel border border-transparent px-4 py-4">
              <Skeleton width="22%" height={22} radius="control" />
              <Skeleton height={420} radius="panel" />
            </div>
            <div className="space-y-4 rounded-ui-panel border border-transparent px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <Skeleton width="26%" height={22} radius="control" />
                <Skeleton width={28} height={28} radius="full" />
              </div>
              <Skeleton height={420} radius="panel" />
            </div>
          </div>
        </div>
      </MicroAppPageLayout>
    );
  }

  const reasonCodeSet = normalizeReasonCodes(report.blockedReasons);
  const appDataRootRecommended = buildRecommendedAppDataRoot(
    report.config.workspaceRoot,
    report.config.appDataRootResolved,
  );
  const fakeProviderFixturePath = buildFakeProviderFixturePath(report.config.workspaceRoot);
  const isFakeProviderSelected =
    draft.command.trim().toLowerCase() === "node" &&
    textToArgs(draft.startArgsText)[0] === fakeProviderFixturePath;
  const appDataRootMissing =
    reasonCodeSet.has("app_data_root_unavailable") || !draft.appDataRoot.trim();
  const canStartRealProvider = !report.blockedReasons.some(
    (reason) =>
      reason.code === "external_index_root_unsupported" ||
      reason.code === "repo_pollution_risk",
  );
  const startDisabled =
    saving ||
    appDataRootMissing ||
    (!isFakeProviderSelected && !canStartRealProvider);
  const stopDisabled = saving || !report.runtime.processAlive;
  const smokeDisabled = saving || (smokeMode === "real" && report.status !== "ready");
  const hasSmokeSummary = summarizeSmokePayload(smokeResult?.payload ?? null);

  const blockedSummaryCards: SummaryReasonCard[] = [];
  if (reasonCodeSet.has("app_data_root_unavailable") || !draft.appDataRoot.trim()) {
    blockedSummaryCards.push({
      key: "app-data-root",
      title: t("settings.microApps.codeGraphStudio.blockedCards.appDataRoot.title"),
      description: t("settings.microApps.codeGraphStudio.blockedCards.appDataRoot.description"),
      badgeLabel: t("settings.microApps.codeGraphStudio.blockedCards.appDataRoot.badge"),
      badgeVariant: "warning",
      icon: FolderCog,
    });
  }
  if (reasonCodeSet.has("external_index_root_unsupported")) {
    blockedSummaryCards.push({
      key: "external-index-root",
      title: t("settings.microApps.codeGraphStudio.blockedCards.externalIndex.title"),
      description: t("settings.microApps.codeGraphStudio.blockedCards.externalIndex.description"),
      badgeLabel: t("settings.microApps.codeGraphStudio.blockedCards.externalIndex.badge"),
      badgeVariant: "danger",
      icon: Siren,
    });
  }
  if (reasonCodeSet.has("repo_pollution_risk") || report.pollutionGuard.status === "blocked") {
    blockedSummaryCards.push({
      key: "pollution-guard",
      title: t("settings.microApps.codeGraphStudio.blockedCards.pollutionGuard.title"),
      description: t("settings.microApps.codeGraphStudio.blockedCards.pollutionGuard.description"),
      badgeLabel: t("settings.microApps.codeGraphStudio.blockedCards.pollutionGuard.badge"),
      badgeVariant: "primary",
      icon: ShieldCheck,
    });
  }

  const overviewChips = [
    {
      key: "planner",
      icon: LockKeyhole,
      text: t("settings.microApps.codeGraphStudio.overview.chips.planner", {
        value: report.config.plannerExposureEnabled
          ? t("settings.microApps.codeGraphStudio.values.enabled")
          : t("settings.microApps.codeGraphStudio.values.disabled"),
      }),
    },
    {
      key: "telemetry",
      icon: SquareTerminal,
      text: t("settings.microApps.codeGraphStudio.overview.chips.telemetry", {
        value:
          report.runtime.telemetryStatus === "disabled"
            ? t("settings.microApps.codeGraphStudio.values.available")
            : t("settings.microApps.codeGraphStudio.values.unavailable"),
      }),
    },
    {
      key: "pollution",
      icon: ShieldCheck,
      text: t("settings.microApps.codeGraphStudio.overview.chips.pollution", {
        value: report.pollutionGuard.exists
          ? t("settings.microApps.codeGraphStudio.values.detected")
          : t("settings.microApps.codeGraphStudio.values.notDetected"),
      }),
    },
    {
      key: "fake-provider",
      icon: FlaskConical,
      text: t("settings.microApps.codeGraphStudio.overview.chips.fakeProvider", {
        value: isFakeProviderSelected
          ? t("settings.microApps.codeGraphStudio.values.selected")
          : t("settings.microApps.codeGraphStudio.values.availableForValidation"),
      }),
    },
  ];

  const toggleFakeProviderMode = () => {
    if (isFakeProviderSelected) {
      const fallbackDraft = realDraftBackup ?? createDraft(report);
      setDraft(fallbackDraft);
      setSmokeMode("real");
      return;
    }

    setRealDraftBackup(draft);
    setSmokeMode("fake");
    setDraft({
      ...draft,
      command: "node",
      startArgsText: argsToText([fakeProviderFixturePath, "--mcp"]),
      versionProbeArgsText: argsToText([fakeProviderFixturePath, "--version"]),
      telemetryProbeArgsText: argsToText([fakeProviderFixturePath, "--telemetry-status"]),
      appDataRoot: draft.appDataRoot.trim() || appDataRootRecommended,
    });
  };

  return (
    <MicroAppPageLayout
      miniTitle="CodeGraph"
      title={t("settings.microApps.codeGraphStudio.page.title")}
      description={t("settings.microApps.codeGraphStudio.page.description")}
      slot={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading || saving}>
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("settings.microApps.codeGraphStudio.actions.refresh")}
          </Button>
          <Button variant="primary" size="sm" onClick={() => void saveConfig()} disabled={saving}>
            {t("settings.microApps.codeGraphStudio.actions.saveConfig")}
          </Button>
        </div>
      }
      contentClassName="space-y-3 pt-4"
    >
      <Card className="shrink-0 overflow-hidden p-0">
        <div className="grid grid-cols-[minmax(0,1.1fr)_260px] gap-0 sm:grid-cols-[minmax(0,1.15fr)_280px] xl:grid-cols-[minmax(0,1.3fr)_320px]">
          <div className="flex h-full flex-col justify-between gap-4 px-3.5 pb-0 pt-3.5 lg:px-4 lg:pb-0 lg:pt-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary">
                  <LockKeyhole className="h-5.5 w-5.5" />
                </div>
                <div className="text-[2rem] font-semibold leading-none tracking-tight text-primary lg:text-[1.75rem]">
                  {toStatusLabel(report.status)}
                </div>
              </div>
              <p className="max-w-2xl text-xs leading-5 text-text-secondary sm:text-sm">
                {t("settings.microApps.codeGraphStudio.overview.description")}
              </p>
            </div>

            <div className="mt-auto grid grid-cols-2 gap-2.5">
              {overviewChips.map((chip) => {
                const ChipIcon = chip.icon;
                return (
                  <div
                    key={chip.key}
                    className="rounded-ui-panel border border-border bg-surface-secondary/40 px-3.5 py-2.5 text-sm text-text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <ChipIcon className="h-4 w-4 text-primary" />
                      <span>{chip.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-l border-border/80 bg-surface-secondary/30 p-3.5 lg:p-4">
            <div className="space-y-2.5">
              <div className="text-sm font-semibold text-text-primary lg:text-[15px]">
                {t("settings.microApps.codeGraphStudio.overview.nextStepsTitle")}
              </div>
              <div className="space-y-2.5">
                {[1, 2, 3].map((index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold leading-none text-white">
                      {index}
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[13px] font-semibold leading-4 text-text-primary lg:text-sm">
                        {t(`settings.microApps.codeGraphStudio.overview.nextSteps.step${index}.title`)}
                      </div>
                      <div className="text-xs leading-4.5 text-text-secondary lg:text-[13px]">
                        {t(`settings.microApps.codeGraphStudio.overview.nextSteps.step${index}.description`)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div data-testid="codegraph-status-card" className="h-full">
          <Card className="h-full p-4">
            <div className="space-y-3">
              <div className="text-lg font-semibold text-text-primary">
                {t("settings.microApps.codeGraphStudio.cards.blockedReasons.title")}
              </div>
              <div className="divide-y divide-border rounded-ui-panel border border-border bg-surface-primary">
                {blockedSummaryCards.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div
                      key={item.key}
                      data-testid={`blocked-summary-${item.key}`}
                      className="flex items-start gap-3 px-3.5 py-3"
                    >
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-primary">
                        <ItemIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-text-primary">{item.title}</div>
                          <Badge variant={item.badgeVariant} size="sm">
                            {item.badgeLabel}
                          </Badge>
                        </div>
                        <div className="text-[13px] leading-5 text-text-secondary">{item.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        </div>

        <div data-testid="codegraph-pollution-card" className="h-full">
          <Card className="h-full p-4">
            <div className="flex h-full flex-col gap-4">
              <div className="text-lg font-semibold text-text-primary">
                {t("settings.microApps.codeGraphStudio.cards.pollutionSummary.title")}
              </div>
              <div className="divide-y divide-border rounded-ui-panel border border-border bg-surface-primary">
                {[
                  {
                    key: "guardStatus",
                    label: t("settings.microApps.codeGraphStudio.fields.guardStatus"),
                    value: report.pollutionGuard.status,
                    emphasize: true,
                  },
                  {
                    key: "repoDataDirPath",
                    label: t("settings.microApps.codeGraphStudio.fields.repoDataDirPath"),
                    value: report.pollutionGuard.repoDataDirPath,
                  },
                  {
                    key: "exists",
                    label: t("settings.microApps.codeGraphStudio.fields.exists"),
                    value: report.pollutionGuard.exists ? "true" : "false",
                  },
                  {
                    key: "behavior",
                    label: t("settings.microApps.codeGraphStudio.fields.behavior"),
                    value: t("settings.microApps.codeGraphStudio.cards.pollutionSummary.behavior"),
                  },
                ].map((row) => (
                  <div
                    key={row.key}
                    className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[148px_minmax(0,1fr)]"
                  >
                    <div className="text-text-secondary">{row.label}</div>
                    <div className={row.emphasize ? "font-medium text-primary" : "break-all text-text-primary"}>
                      {row.value}
                    </div>
                  </div>
                ))}
              </div>
              <Alert
                className="mt-auto"
                variant="warning"
                title={t("settings.microApps.codeGraphStudio.cards.pollutionSummary.noticeTitle")}
              />
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div data-testid="codegraph-config-card" className="h-full">
          <Card className="h-full p-4">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-lg font-semibold text-text-primary">
                  {t("settings.microApps.codeGraphStudio.cards.config.title")}
                </div>
                <div className="text-sm leading-6 text-text-secondary">
                  {t("settings.microApps.codeGraphStudio.cards.config.description")}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <TextInput
                  compact
                  label={t("settings.microApps.codeGraphStudio.fields.workspaceRootReadonly")}
                  value={report.config.workspaceRoot}
                  onChange={() => {}}
                  disabled
                />
                <TextInput
                  compact
                  label={t("settings.microApps.codeGraphStudio.fields.command")}
                  value={draft.command}
                  onChange={(value) =>
                    setDraft((current) => (current ? { ...current, command: value } : current))
                  }
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_152px]">
                  <TextInput
                    compact
                    label={t("settings.microApps.codeGraphStudio.fields.appDataRootRequired")}
                    labelHelp={t("settings.microApps.codeGraphStudio.cards.config.appDataRootHelp")}
                    value={draft.appDataRoot}
                    placeholder={t("settings.microApps.codeGraphStudio.placeholders.appDataRoot")}
                    onChange={(value) =>
                      setDraft((current) => (current ? { ...current, appDataRoot: value } : current))
                    }
                    disabled={saving}
                  />
                  <div className="flex items-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                appDataRoot: appDataRootRecommended,
                              }
                            : current,
                        )
                      }
                      disabled={saving}
                    >
                      {t("settings.microApps.codeGraphStudio.actions.useRecommendedRoot")}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <TextInput
                  compact
                  label={t("settings.microApps.codeGraphStudio.fields.timeoutMs")}
                  value={draft.timeoutMs}
                  onChange={(value) =>
                    setDraft((current) => (current ? { ...current, timeoutMs: value } : current))
                  }
                  disabled={saving}
                />
                <TextInput
                  compact
                  label={t("settings.microApps.codeGraphStudio.fields.maxResults")}
                  value={draft.maxResults}
                  onChange={(value) =>
                    setDraft((current) => (current ? { ...current, maxResults: value } : current))
                  }
                  disabled={saving}
                />
                <TextInput
                  compact
                  label={t("settings.microApps.codeGraphStudio.fields.queryLimit")}
                  value={draft.queryLimit}
                  onChange={(value) =>
                    setDraft((current) => (current ? { ...current, queryLimit: value } : current))
                  }
                  disabled={saving}
                />
              </div>

              <div className="space-y-3 border-t border-border/70 pt-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <TextInput
                    compact
                    label={t("settings.microApps.codeGraphStudio.fields.logRoot")}
                    value={report.config.logRoot ?? ""}
                    onChange={() => {}}
                    disabled
                  />
                  <TextInput
                    compact
                    label={t("settings.microApps.codeGraphStudio.fields.indexRoot")}
                    value={report.config.indexRoot ?? ""}
                    onChange={() => {}}
                    disabled
                  />
                </div>
                <TextArea
                  compact
                  label={t("settings.microApps.codeGraphStudio.fields.startArgs")}
                  value={draft.startArgsText}
                  onChange={(value) =>
                    setDraft((current) => (current ? { ...current, startArgsText: value } : current))
                  }
                  rows={3}
                  disabled={saving}
                />
                <div className="grid gap-3 md:grid-cols-2">
                  <TextArea
                    compact
                    label={t("settings.microApps.codeGraphStudio.fields.versionProbeArgs")}
                    value={draft.versionProbeArgsText}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, versionProbeArgsText: value } : current,
                      )
                    }
                    rows={3}
                    disabled={saving}
                  />
                  <TextArea
                    compact
                    label={t("settings.microApps.codeGraphStudio.fields.telemetryProbeArgs")}
                    value={draft.telemetryProbeArgsText}
                    onChange={(value) =>
                      setDraft((current) =>
                        current ? { ...current, telemetryProbeArgsText: value } : current,
                      )
                    }
                    rows={3}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div data-testid="codegraph-actions-card" className="h-full">
          <Card className="h-full p-4">
            <div className="flex h-full flex-col gap-5">
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-text-primary">
                    {t("settings.microApps.codeGraphStudio.cards.actions.title")}
                  </div>
                  <div className="text-sm leading-6 text-text-secondary">
                    {t("settings.microApps.codeGraphStudio.cards.actions.description")}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button size="sm" variant="outline" onClick={() => void runAction("detect")} disabled={saving}>
                    {t("settings.microApps.codeGraphStudio.actions.detect")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void runAction("health")} disabled={saving}>
                    {t("settings.microApps.codeGraphStudio.actions.health")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void runAction("start")}
                    disabled={startDisabled}
                  >
                    {t("settings.microApps.codeGraphStudio.actions.start")}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger-outline"
                    onClick={() => void runAction("stop")}
                    disabled={stopDisabled}
                  >
                    {t("settings.microApps.codeGraphStudio.actions.stop")}
                  </Button>
                </div>

                {startDisabled ? (
                  <div className="text-sm leading-5 text-warning">
                    {isFakeProviderSelected
                      ? t("settings.microApps.codeGraphStudio.cards.actions.startHintFake")
                      : t("settings.microApps.codeGraphStudio.cards.actions.startHintBlocked")}
                  </div>
                ) : null}
              </div>

              <div className="h-px bg-border" />

              <div data-testid="codegraph-smoke-card" className="space-y-4">
                <div className="space-y-1">
                  <div className="text-lg font-semibold text-text-primary">
                    {t("settings.microApps.codeGraphStudio.cards.smoke.title")}
                  </div>
                  <div className="text-sm leading-6 text-text-secondary">
                    {t("settings.microApps.codeGraphStudio.cards.smoke.description")}
                  </div>
                </div>

                <SegmentedTabs<SmokeMode>
                  size="sm"
                  value={smokeMode}
                  onChange={setSmokeMode}
                  items={[
                    {
                      value: "real",
                      label: t("settings.microApps.codeGraphStudio.cards.smoke.modes.real"),
                    },
                    {
                      value: "fake",
                      label: t("settings.microApps.codeGraphStudio.cards.smoke.modes.fake"),
                    },
                  ]}
                />

                {smokeMode === "real" ? (
                  <Alert
                    variant={report.status === "ready" ? "success" : "warning"}
                    title={t("settings.microApps.codeGraphStudio.cards.smoke.realTitle")}
                  />
                ) : (
                  <div className="space-y-3">
                    <Alert
                      variant="info"
                      title={t("settings.microApps.codeGraphStudio.cards.smoke.fakeTitle")}
                    >
                      {t("settings.microApps.codeGraphStudio.cards.smoke.fakeDescription")}
                    </Alert>
                    <div className="flex items-center justify-between rounded-ui-panel border border-border bg-surface-secondary/30 px-4 py-3">
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-text-primary">
                          {t("settings.microApps.codeGraphStudio.cards.smoke.fakeToggleTitle")}
                        </div>
                        <div className="text-sm text-text-secondary">
                          {t("settings.microApps.codeGraphStudio.cards.smoke.fakeToggleHint")}
                        </div>
                      </div>
                      <Switch
                        checked={isFakeProviderSelected}
                        onChange={toggleFakeProviderMode}
                        ariaLabel={t("settings.microApps.codeGraphStudio.cards.smoke.fakeToggleTitle")}
                      />
                    </div>
                  </div>
                )}

                <TextArea
                  label={t("settings.microApps.codeGraphStudio.fields.smokeQuery")}
                  value={draft.smokeQuery}
                  onChange={(value) =>
                    setDraft((current) => (current ? { ...current, smokeQuery: value } : current))
                  }
                  rows={3}
                  disabled={saving}
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runAction("smoke-status")}
                    disabled={smokeDisabled}
                  >
                    {t("settings.microApps.codeGraphStudio.actions.smokeStatus")}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void runAction("smoke-query")}
                    disabled={smokeDisabled}
                  >
                    {t("settings.microApps.codeGraphStudio.actions.smokeQuery")}
                  </Button>
                </div>

              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div data-testid="codegraph-smoke-result-card">
          <Card className="h-[500px] p-4">
          <div className="flex h-full flex-col gap-4">
            <div className="space-y-1">
              <div className="text-lg font-semibold text-text-primary">
                {t("settings.microApps.codeGraphStudio.cards.smokeResult.title")}
              </div>
              <div className="text-sm leading-6 text-text-secondary">
                {t("settings.microApps.codeGraphStudio.cards.smokeResult.description")}
              </div>
            </div>

            {smokeResult ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={smokeResult.ok ? "success" : "danger"} size="sm">
                    {smokeMode === "fake"
                      ? t("settings.microApps.codeGraphStudio.cards.smoke.modes.fake")
                      : t("settings.microApps.codeGraphStudio.cards.smoke.modes.real")}
                  </Badge>
                  <Badge variant={smokeResult.ok ? "success" : "warning"} size="sm">
                    {smokeResult.kind} ·{" "}
                    {smokeResult.ok
                      ? t("settings.microApps.codeGraphStudio.values.ready")
                      : t("settings.microApps.codeGraphStudio.values.blocked")}
                  </Badge>
                </div>

                <div className="rounded-ui-panel border border-border bg-surface-secondary/30 px-4 py-3 text-sm leading-6 text-text-primary">
                  {smokeResult.message}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Card
                    variant="subtle"
                    label={t("settings.microApps.codeGraphStudio.cards.smokeResult.metrics.status")}
                    value={smokeResult.ok ? t("settings.microApps.codeGraphStudio.values.ready") : t("settings.microApps.codeGraphStudio.values.blocked")}
                    padding="sm"
                  />
                  <Card
                    variant="subtle"
                    label={t("settings.microApps.codeGraphStudio.cards.smokeResult.metrics.candidates")}
                    value={hasSmokeSummary?.candidates ?? "—"}
                    padding="sm"
                  />
                  <Card
                    variant="subtle"
                    label={t("settings.microApps.codeGraphStudio.cards.smokeResult.metrics.content")}
                    value={hasSmokeSummary?.content ?? "—"}
                    padding="sm"
                  />
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-6 text-center">
                <div className="text-5xl text-text-tertiary/60">≌</div>
                <div className="space-y-1">
                  <div className="text-base font-medium text-text-primary">
                    {t("settings.microApps.codeGraphStudio.states.emptySmokeTitle")}
                  </div>
                  <div className="max-w-xl text-sm leading-6 text-text-secondary">
                    {t("settings.microApps.codeGraphStudio.states.emptySmoke")}
                  </div>
                </div>
              </div>
            )}
          </div>
          </Card>
        </div>

        <Card className="h-[500px] p-4">
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="min-w-0">
                  <div className="text-lg font-semibold text-text-primary">
                    {t("settings.microApps.codeGraphStudio.cards.debug.title")}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <IconButton
                  size="sm"
                  styleType="ghost"
                  ariaLabel={t("settings.microApps.codeGraphStudio.actions.copyDebug")}
                  onClick={() => void copyDebugReport()}
                >
                  <Copy className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            <div className="min-h-0 flex-1 border-t border-border/70 pt-3">
              <pre className="h-full overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-all rounded-ui-panel border border-border bg-surface-secondary/20 p-3 text-xs text-text-secondary">
                {JSON.stringify(report, null, 2)}
              </pre>
            </div>
          </div>
        </Card>
      </div>
    </MicroAppPageLayout>
  );
}
