import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCcw } from "lucide-react";
import Alert from "@/shared/ui/Alert";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import {
  Button,
  Result,
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
  type CodeGraphStudioReport,
  type CodeGraphStudioSmokeResult,
} from "@/shared/api/codegraphStudio";

type CodeGraphDraft = {
  microAppEnabled: boolean;
  command: string;
  startArgsText: string;
  versionProbeArgsText: string;
  telemetryProbeArgsText: string;
  appDataRoot: string;
  timeoutMs: string;
  maxResults: string;
  queryLimit: string;
};

const argsToText = (value: string[]) => value.join("\n");
const textToArgs = (value: string) =>
  value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

const createDraft = (report: CodeGraphStudioReport): CodeGraphDraft => ({
  microAppEnabled: report.config.microAppEnabled,
  command: report.config.command,
  startArgsText: argsToText(report.config.startArgs),
  versionProbeArgsText: argsToText(report.config.versionProbeArgs),
  telemetryProbeArgsText: argsToText(report.config.telemetryProbeArgs),
  appDataRoot: report.config.appDataRoot,
  timeoutMs: String(report.config.timeoutMs),
  maxResults: String(report.config.maxResults),
  queryLimit: String(report.config.queryLimit),
});

const buildSavePayload = (draft: CodeGraphDraft) => ({
  microAppEnabled: draft.microAppEnabled,
  agentCapabilityEnabled: draft.microAppEnabled,
  command: draft.command.trim(),
  startArgs: textToArgs(draft.startArgsText),
  versionProbeArgs: textToArgs(draft.versionProbeArgsText),
  telemetryProbeArgs: textToArgs(draft.telemetryProbeArgsText),
  appDataRoot: draft.appDataRoot.trim(),
  timeoutMs: Number(draft.timeoutMs),
  maxResults: Number(draft.maxResults),
  queryLimit: Number(draft.queryLimit),
});

const toStatusVariant = (status: CodeGraphStudioReport["status"]) => {
  if (status === "ready") return "success" as const;
  if (status === "blocked" || status === "unavailable") return "warning" as const;
  return "muted" as const;
};

export default function CodeGraphStudioPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [report, setReport] = useState<CodeGraphStudioReport | null>(null);
  const [draft, setDraft] = useState<CodeGraphDraft | null>(null);
  const [debugWorkspacePath, setDebugWorkspacePath] = useState("");
  const [smokeQuery, setSmokeQuery] = useState("Planner -> Normalize -> Policy -> ToolNode -> Evidence");
  const [smokeResult, setSmokeResult] = useState<CodeGraphStudioSmokeResult | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const nextReport = await getCodeGraphStudioReport();
      setReport(nextReport);
      setDraft(createDraft(nextReport));
      setDebugWorkspacePath((current) => current.trim() || nextReport.config.workspaceRoot);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载 CodeGraph 失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveConfig = async (nextDraft = draft) => {
    if (!nextDraft) return null;
    const nextReport = await saveCodeGraphStudioConfig(buildSavePayload(nextDraft));
    setReport(nextReport);
    setDraft(createDraft(nextReport));
    return nextReport;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig();
      message.success("CodeGraph 参数已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存 CodeGraph 参数失败");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async () => {
    if (!draft) return;
    const nextDraft = { ...draft, microAppEnabled: !draft.microAppEnabled };
    setDraft(nextDraft);
    setSaving(true);
    try {
      await saveConfig(nextDraft);
    } catch (error) {
      setDraft(draft);
      message.error(error instanceof Error ? error.message : "保存 CodeGraph 参数失败");
    } finally {
      setSaving(false);
    }
  };

  const runRuntimeAction = async (action: "detect" | "start" | "health" | "stop") => {
    setSaving(true);
    try {
      if (action !== "stop") {
        await saveConfig();
      }
      const result =
        action === "detect"
          ? await detectCodeGraphStudio()
          : action === "start"
            ? await startCodeGraphStudio()
            : action === "health"
              ? await healthCodeGraphStudio()
              : await stopCodeGraphStudio();
      setReport(result.report);
      setDraft(createDraft(result.report));
      message.success(`${action} 已执行`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "CodeGraph 操作失败");
    } finally {
      setSaving(false);
    }
  };

  const runSmoke = async (kind: "status" | "query") => {
    const workspacePath = debugWorkspacePath.trim();
    if (!workspacePath) {
      message.error("请先填写 Debug Workspace Path");
      return;
    }
    setSaving(true);
    try {
      await saveConfig();
      const result =
        kind === "status"
          ? await smokeStatusCodeGraphStudio(workspacePath)
          : await smokeQueryCodeGraphStudio(smokeQuery, workspacePath);
      setSmokeResult(result);
      setReport(result.report);
      setDraft(createDraft(result.report));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "CodeGraph Smoke 失败");
    } finally {
      setSaving(false);
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
        <Skeleton height={180} radius="panel" />
        <Skeleton height={360} radius="panel" />
      </MicroAppPageLayout>
    );
  }

  return (
    <MicroAppPageLayout
      miniTitle="CodeGraph"
      title={t("settings.microApps.codeGraphStudio.page.title")}
      description={t("settings.microApps.codeGraphStudio.page.description")}
      slot={
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={saving}>
          <RefreshCcw className="h-4 w-4" />
          刷新
        </Button>
      }
      contentClassName="space-y-4 pt-4"
    >
      <Card className="p-4" data-testid="codegraph-status-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="text-lg font-semibold text-text-primary">Runtime</div>
              <Badge variant={toStatusVariant(report.status)} size="sm">
                {report.status}
              </Badge>
            </div>
            <div className="text-sm text-text-secondary">
              Studio 默认路径只用于本页默认值；Agent 实际运行按线程绑定当前 workspace。
            </div>
          </div>
          <div className="text-right text-xs leading-5 text-text-secondary">
            <div>Provider: {report.runtime.providerVersion ?? "unknown"}</div>
            <div>Capability: {report.config.capabilityRegistered ? "registered" : "not registered"}</div>
          </div>
        </div>
        {report.blockedReasons.length > 0 ? (
          <Alert variant="warning" title="Studio runtime diagnostics">
            {report.blockedReasons.map((reason) => reason.message).join(" · ")}
          </Alert>
        ) : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-4" data-testid="codegraph-config-card">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-text-primary">基础配置</div>
                <div className="text-sm text-text-secondary">这里只保留运行和验证需要的参数。</div>
              </div>
              <Switch
                checked={draft.microAppEnabled}
                onChange={() => void toggleEnabled()}
                ariaLabel="启用 CodeGraph 微应用"
                disabled={saving}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <TextInput
                compact
                label="Command"
                value={draft.command}
                onChange={(value) => setDraft((current) => current ? { ...current, command: value } : current)}
                disabled={saving}
              />
              <TextInput
                compact
                label="App Data Root"
                value={draft.appDataRoot}
                onChange={(value) => setDraft((current) => current ? { ...current, appDataRoot: value } : current)}
                disabled={saving}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <TextInput
                compact
                label="Timeout (ms)"
                value={draft.timeoutMs}
                onChange={(value) => setDraft((current) => current ? { ...current, timeoutMs: value } : current)}
                disabled={saving}
              />
              <TextInput
                compact
                label="Max Results"
                value={draft.maxResults}
                onChange={(value) => setDraft((current) => current ? { ...current, maxResults: value } : current)}
                disabled={saving}
              />
              <TextInput
                compact
                label="Query Limit"
                value={draft.queryLimit}
                onChange={(value) => setDraft((current) => current ? { ...current, queryLimit: value } : current)}
                disabled={saving}
              />
            </div>

            <TextArea
              compact
              label="Start Args"
              value={draft.startArgsText}
              onChange={(value) => setDraft((current) => current ? { ...current, startArgsText: value } : current)}
              rows={3}
              disabled={saving}
            />

            <details className="rounded-ui-panel border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium text-text-primary">Probe 参数</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <TextArea
                  compact
                  label="Version Probe Args"
                  value={draft.versionProbeArgsText}
                  onChange={(value) => setDraft((current) => current ? { ...current, versionProbeArgsText: value } : current)}
                  rows={3}
                  disabled={saving}
                />
                <TextArea
                  compact
                  label="Telemetry Probe Args"
                  value={draft.telemetryProbeArgsText}
                  onChange={(value) => setDraft((current) => current ? { ...current, telemetryProbeArgsText: value } : current)}
                  rows={3}
                  disabled={saving}
                />
              </div>
            </details>

            <Button variant="primary" size="sm" onClick={() => void handleSave()} disabled={saving}>
              保存参数
            </Button>
          </div>
        </Card>

        <Card className="p-4" data-testid="codegraph-actions-card">
          <div className="space-y-4">
            <div>
              <div className="text-lg font-semibold text-text-primary">运行时动作</div>
              <div className="text-sm text-text-secondary">这些动作只调试 Studio 默认 runtime，不决定 Agent 线程绑定。</div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button size="sm" variant="outline" onClick={() => void runRuntimeAction("detect")} disabled={saving}>detect</Button>
              <Button size="sm" variant="outline" onClick={() => void runRuntimeAction("health")} disabled={saving}>health</Button>
              <Button size="sm" variant="secondary" onClick={() => void runRuntimeAction("start")} disabled={saving}>start</Button>
              <Button size="sm" variant="danger-outline" onClick={() => void runRuntimeAction("stop")} disabled={saving || !report.runtime.processAlive}>stop</Button>
            </div>

            <div className="border-t border-border pt-4" data-testid="codegraph-smoke-card">
              <div className="mb-3">
                <div className="text-lg font-semibold text-text-primary">Path Smoke 验证</div>
                <div className="text-sm text-text-secondary">
                  直接指定项目根目录。Smoke 会按这个 path 建立/复用 CodeGraph runtime，不要求它匹配 Studio 默认 workspace。
                </div>
              </div>

              <div className="space-y-3">
                <TextInput
                  compact
                  label="Debug Workspace Path"
                  value={debugWorkspacePath}
                  placeholder="D:\\path\\to\\project"
                  onChange={setDebugWorkspacePath}
                  disabled={saving}
                />
                <TextArea
                  label="Smoke Query"
                  value={smokeQuery}
                  onChange={setSmokeQuery}
                  rows={3}
                  disabled={saving}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void runSmoke("status")}
                    disabled={saving || !debugWorkspacePath.trim()}
                  >
                    运行 Smoke Status
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void runSmoke("query")}
                    disabled={saving || !debugWorkspacePath.trim() || !smokeQuery.trim()}
                  >
                    运行 Smoke
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-4" data-testid="codegraph-smoke-result-card">
        <div className="space-y-3">
          <div className="text-lg font-semibold text-text-primary">Smoke 结果</div>
          {smokeResult ? (
            <>
              <Alert variant={smokeResult.ok ? "success" : "warning"} title={smokeResult.ok ? "通过" : "未通过"}>
                {smokeResult.message}
              </Alert>
              <pre className="max-h-[360px] overflow-auto rounded-ui-panel border border-border bg-surface-secondary/40 p-3 text-xs leading-5 text-text-primary">
                {JSON.stringify(smokeResult.payload, null, 2)}
              </pre>
            </>
          ) : (
            <Result
              size="sm"
              title="还没有 Smoke 结果"
              description="填入要验证的项目 path，然后运行 Smoke Status 或 Smoke Query。"
            />
          )}
        </div>
      </Card>

      <details className="rounded-ui-panel border border-border bg-surface-primary p-4">
        <summary className="cursor-pointer text-sm font-semibold text-text-primary">原始调试报告</summary>
        <pre className="mt-3 max-h-[420px] overflow-auto text-xs leading-5 text-text-secondary">
          {JSON.stringify(report, null, 2)}
        </pre>
      </details>
    </MicroAppPageLayout>
  );
}
