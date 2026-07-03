import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  ArrowDownAZ,
  ArrowUpZA,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react";
import Card from "./Card";
import { ModalShell } from "./Modal";

export interface CoverageMetric {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface CoverageEntry {
  lines: CoverageMetric;
  statements: CoverageMetric;
  functions: CoverageMetric;
  branches: CoverageMetric;
  branchesTrue?: CoverageMetric | null;
}

export interface CoverageFileReport {
  path: string;
  absolutePath: string;
  summary: CoverageEntry;
  lines: {
    map: Record<string, unknown>;
    hits: Record<string, number>;
  };
  statements: {
    map: Record<string, unknown>;
    hits: Record<string, number>;
  };
  functions: {
    map: Record<string, unknown>;
    hits: Record<string, number>;
  };
  branches: Array<{
    id: string;
    line: number | null;
    type: string;
    locations: Array<{
      index: number;
      start: unknown;
      end: unknown;
      count: number;
    }>;
  }>;
}

export interface CoverageReport {
  schemaVersion: number;
  generatedAt: string;
  scope: "client" | "server" | string;
  summary: {
    total?: CoverageEntry;
  } & Record<string, CoverageEntry | undefined>;
  files: CoverageFileReport[];
  available?: boolean;
  missingReason?: string;
}

export type TestStatus = "passed" | "failed" | "skipped" | "pending" | "todo";

export interface TestCaseResult {
  ancestorTitles: string[];
  fullName: string;
  title: string;
  status: TestStatus | string;
  duration: number | null;
  failureMessages: string[];
  meta?: Record<string, unknown>;
}

export interface TestSuiteResult {
  name: string;
  absoluteName: string;
  status: string;
  startTime: number | null;
  endTime: number | null;
  message: string;
  assertionResults: TestCaseResult[];
}

export interface TestReport {
  schemaVersion: number;
  generatedAt: string;
  scope: "client" | "server" | string;
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    pendingTests: number;
    todoTests: number;
    totalSuites: number;
    passedSuites: number;
    failedSuites: number;
    pendingSuites: number;
    success: boolean;
    startTime: number | null;
    durationMs: number;
  };
  suites: TestSuiteResult[];
}

export interface CoverageReportPanelProps {
  src?: string;
  resultSrc?: string;
  title?: ReactNode;
  emptyText?: ReactNode;
  errorText?: ReactNode;
  className?: string;
}

type LoadState<T> =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ready"; data: T }
  | { status: "empty" }
  | { status: "error"; error: string };

type SortKey =
  | "name"
  | "tests"
  | "passed"
  | "failed"
  | "skipped"
  | "duration"
  | "statements"
  | "branches"
  | "functions"
  | "lines";
type SortOrder = "asc" | "desc";

interface FileTableEntry {
  path: string;
  name: string;
  suites: TestSuiteResult[];
  tests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  coverage?: CoverageEntry;
  coverageFile?: CoverageFileReport;
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function getPctClass(pct: number): string {
  if (pct >= 80) {
    return "text-success";
  }
  if (pct >= 50) {
    return "text-warning";
  }
  return "text-danger";
}

function getPctBarClass(pct: number): string {
  if (pct >= 80) {
    return "bg-success";
  }
  if (pct >= 50) {
    return "bg-warning";
  }
  return "bg-danger";
}

function getStatusClass(status: string): string {
  if (status === "passed") {
    return "text-success";
  }
  if (status === "failed") {
    return "text-danger";
  }
  return "text-text-tertiary";
}

function CoveragePctCell({ pct }: { pct?: number }) {
  if (typeof pct !== "number") {
    return <span className="text-text-tertiary">-</span>;
  }

  return (
    <div className="flex min-w-[72px] flex-col gap-1">
      <span className={`font-medium ${getPctClass(pct)}`}>{formatPct(pct)}</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary">
        <div
          className={`h-full rounded-full transition-all ${getPctBarClass(pct)}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function normalizeSuiteFileName(suite: TestSuiteResult): string {
  const raw = suite.name || suite.absoluteName;
  return raw.split("/").pop() || raw;
}

function countCoveredHits(hits: Record<string, number>): number {
  return Object.values(hits).filter((value) => value > 0).length;
}

function countUncoveredHits(hits: Record<string, number>): number {
  return Object.values(hits).filter((value) => value <= 0).length;
}

function getUncoveredKeys(hits: Record<string, number>, limit = 8): string[] {
  return Object.entries(hits)
    .filter(([, value]) => value <= 0)
    .slice(0, limit)
    .map(([key]) => key);
}

function getUncoveredBranchItems(branches: CoverageFileReport["branches"], limit = 8) {
  const items: string[] = [];
  for (const branch of branches) {
    const uncoveredLocations = branch.locations
      .filter((location) => location.count <= 0)
      .map((location) => `#${location.index}`);

    if (uncoveredLocations.length > 0) {
      items.push(
        `line ${branch.line ?? "-"} · ${branch.type} · ${uncoveredLocations.join(", ")}`,
      );
    }

    if (items.length >= limit) {
      break;
    }
  }
  return items;
}

function getSuiteDuration(suite: TestSuiteResult): number {
  if (
    typeof suite.startTime === "number" &&
    typeof suite.endTime === "number"
  ) {
    return Math.max(0, suite.endTime - suite.startTime);
  }

  return suite.assertionResults.reduce(
    (sum, test) => sum + (typeof test.duration === "number" ? test.duration : 0),
    0,
  );
}

function isCoverageReport(data: unknown): data is CoverageReport {
  return Boolean(
    data &&
      typeof data === "object" &&
      "summary" in data &&
      "files" in data &&
      Array.isArray((data as CoverageReport).files),
  );
}

function isTestReport(data: unknown): data is TestReport {
  return Boolean(
    data &&
      typeof data === "object" &&
      "summary" in data &&
      "suites" in data &&
      Array.isArray((data as TestReport).suites),
  );
}

export default function CoverageReportPanel({
  src,
  resultSrc,
  title,
  emptyText = "覆盖率报告暂不可用",
  errorText = "覆盖率报告加载失败",
  className = "",
}: CoverageReportPanelProps) {
  const { t } = useTranslation();
  const [coverageState, setCoverageState] = useState<LoadState<CoverageReport>>(
    src ? { status: "checking" } : { status: "idle" },
  );
  const [resultState, setResultState] = useState<LoadState<TestReport>>(
    resultSrc ? { status: "checking" } : { status: "idle" },
  );
  const [sortKey, setSortKey] = useState<SortKey>("failed");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  useEffect(() => {
    if (!src) {
      setCoverageState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setCoverageState({ status: "checking" });

    fetch(src)
      .then(async (res) => {
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setCoverageState({ status: "empty" });
          return;
        }
        const data = (await res.json()) as unknown;
        if (!isCoverageReport(data)) {
          setCoverageState({ status: "empty" });
          return;
        }
        setCoverageState({ status: "ready", data });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setCoverageState({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (!resultSrc) {
      setResultState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setResultState({ status: "checking" });

    fetch(resultSrc)
      .then(async (res) => {
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setResultState({ status: "empty" });
          return;
        }
        const data = (await res.json()) as unknown;
        if (!isTestReport(data)) {
          setResultState({ status: "empty" });
          return;
        }
        setResultState({ status: "ready", data });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setResultState({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [resultSrc]);

  const coverageFiles = coverageState.status === "ready" ? coverageState.data.files : [];
  const coverageTotal =
    coverageState.status === "ready" ? coverageState.data.summary.total : undefined;
  const resultSummary =
    resultState.status === "ready" ? resultState.data.summary : undefined;
  const suites = resultState.status === "ready" ? resultState.data.suites : [];

  const fileEntries = useMemo<FileTableEntry[]>(() => {
    const suitesByFile = new Map<string, TestSuiteResult[]>();
    for (const suite of suites) {
      const key = normalizeSuiteFileName(suite);
      const current = suitesByFile.get(key) ?? [];
      current.push(suite);
      suitesByFile.set(key, current);
    }

    const coverageByFile = new Map<string, CoverageFileReport>();
    for (const file of coverageFiles) {
      coverageByFile.set(file.path.split("/").pop() || file.path, file);
    }

    const allFileNames = new Set<string>([
      ...suitesByFile.keys(),
      ...coverageByFile.keys(),
    ]);

    return [...allFileNames].map((name) => {
      const fileSuites = suitesByFile.get(name) ?? [];
      const coverage = coverageByFile.get(name)?.summary;
      const tests = fileSuites.flatMap((suite) => suite.assertionResults);

      return {
        path: coverageByFile.get(name)?.path ?? fileSuites[0]?.name ?? name,
        name,
        suites: fileSuites,
        tests: tests.length,
        passed: tests.filter((test) => test.status === "passed").length,
        failed: tests.filter((test) => test.status === "failed").length,
        skipped: tests.filter(
          (test) =>
            test.status === "skipped" ||
            test.status === "pending" ||
            test.status === "todo",
        ).length,
        durationMs: fileSuites.reduce(
          (sum, suite) => sum + getSuiteDuration(suite),
          0,
        ),
        coverage,
        coverageFile: coverageByFile.get(name),
      };
    });
  }, [coverageFiles, suites]);

  const sortedEntries = useMemo(() => {
    const sorted = [...fileEntries];
    sorted.sort((left, right) => {
      const factor = sortOrder === "asc" ? 1 : -1;

      if (sortKey === "name") {
        return factor * left.name.localeCompare(right.name);
      }

      if (sortKey === "tests") {
        return factor * (left.tests - right.tests);
      }
      if (sortKey === "passed") {
        return factor * (left.passed - right.passed);
      }
      if (sortKey === "failed") {
        if (left.failed !== right.failed) {
          return factor * (left.failed - right.failed);
        }
        return factor * (right.tests - left.tests);
      }
      if (sortKey === "skipped") {
        return factor * (left.skipped - right.skipped);
      }
      if (sortKey === "duration") {
        return factor * (left.durationMs - right.durationMs);
      }

      const leftPct = left.coverage?.[sortKey]?.pct ?? -1;
      const rightPct = right.coverage?.[sortKey]?.pct ?? -1;
      return factor * (leftPct - rightPct);
    });
    return sorted;
  }, [fileEntries, sortKey, sortOrder]);

  const selectedEntry = useMemo(
    () => fileEntries.find((entry) => entry.path === selectedFilePath) ?? null,
    [fileEntries, selectedFilePath],
  );
  const selectedCoverageFile = selectedEntry?.coverageFile;
  const uncoveredLines = selectedCoverageFile
    ? getUncoveredKeys(selectedCoverageFile.lines.hits)
    : [];
  const uncoveredStatements = selectedCoverageFile
    ? getUncoveredKeys(selectedCoverageFile.statements.hits)
    : [];
  const uncoveredFunctions = selectedCoverageFile
    ? getUncoveredKeys(selectedCoverageFile.functions.hits)
    : [];
  const uncoveredBranches = selectedCoverageFile
    ? getUncoveredBranchItems(selectedCoverageFile.branches)
    : [];

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortOrder(key === "name" ? "asc" : "desc");
  };

  const SortHeader = ({
    label,
    activeKey,
    className: extraClassName = "",
  }: {
    label: string;
    activeKey: SortKey;
    className?: string;
  }) => {
    const active = sortKey === activeKey;
    const Icon = active && sortOrder === "desc" ? ArrowUpZA : ArrowDownAZ;

    return (
      <button
        type="button"
        onClick={() => handleSort(activeKey)}
        className={`inline-flex items-center gap-1 text-left text-xs font-medium transition-colors ${
          active
            ? "text-text-primary"
            : "text-text-secondary hover:text-text-primary"
        } ${extraClassName}`}
      >
        {label}
        {active ? <Icon className="h-3 w-3" /> : null}
      </button>
    );
  };

  const isLoading =
    (coverageState.status === "checking" || coverageState.status === "idle") &&
    (resultState.status === "checking" || resultState.status === "idle");

  if (isLoading) {
    return (
      <Card className={`space-y-3 ${className}`}>
        {title ? (
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        ) : null}
        <div className="flex h-[200px] items-center justify-center text-sm text-text-secondary">
          加载中…
        </div>
      </Card>
    );
  }

  if (
    coverageState.status === "error" &&
    resultState.status !== "ready" &&
    resultState.status !== "error"
  ) {
    return (
      <Card className={`space-y-3 ${className}`}>
        {title ? (
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        ) : null}
        <div className="flex h-[200px] flex-col items-center justify-center gap-1 text-sm text-danger">
          <span>{errorText}</span>
          <span className="text-xs text-text-tertiary">{coverageState.error}</span>
        </div>
      </Card>
    );
  }

  if (
    coverageState.status === "empty" &&
    resultState.status !== "ready" &&
    resultState.status !== "error"
  ) {
    return (
      <Card className={`space-y-3 ${className}`}>
        {title ? (
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        ) : null}
        <div className="flex h-[200px] items-center justify-center px-4 text-center text-sm text-text-secondary">
          {emptyText}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={`flex h-full flex-col space-y-4 ${className}`}>
        {title ? (
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        ) : null}

        {resultSummary ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {resultSummary.failedTests > 0 ? (
                <AlertCircle className="h-4 w-4 text-danger" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success" />
              )}
              <h3 className="text-sm font-semibold text-text-primary">
                {t("settings.development.testResults.title")}
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                <div className="text-xs text-text-tertiary">
                  {t("settings.development.testResults.total")}
                </div>
                <div className="text-lg font-semibold text-text-primary">
                  {resultSummary.totalTests}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                <div className="text-xs text-text-tertiary">
                  {t("settings.development.testResults.passed")}
                </div>
                <div className="text-lg font-semibold text-success">
                  {resultSummary.passedTests}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                <div className="text-xs text-text-tertiary">
                  {t("settings.development.testResults.failed")}
                </div>
                <div
                  className={`text-lg font-semibold ${
                    resultSummary.failedTests > 0
                      ? "text-danger"
                      : "text-text-primary"
                  }`}
                >
                  {resultSummary.failedTests}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                <div className="text-xs text-text-tertiary">
                  {t("settings.development.testResults.duration")}
                </div>
                <div className="flex items-center gap-1 text-lg font-semibold text-text-primary">
                  <Clock className="h-3.5 w-3.5 text-icon-tertiary" />
                  {formatDuration(resultSummary.durationMs)}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {coverageTotal ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
              <div className="text-xs text-text-tertiary">Statements</div>
              <div
                className={`text-lg font-semibold ${getPctClass(coverageTotal.statements.pct)}`}
              >
                {formatPct(coverageTotal.statements.pct)}
              </div>
              <div className="text-xs text-text-tertiary">
                {coverageTotal.statements.covered}/{coverageTotal.statements.total}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
              <div className="text-xs text-text-tertiary">Branches</div>
              <div
                className={`text-lg font-semibold ${getPctClass(coverageTotal.branches.pct)}`}
              >
                {formatPct(coverageTotal.branches.pct)}
              </div>
              <div className="text-xs text-text-tertiary">
                {coverageTotal.branches.covered}/{coverageTotal.branches.total}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
              <div className="text-xs text-text-tertiary">Functions</div>
              <div
                className={`text-lg font-semibold ${getPctClass(coverageTotal.functions.pct)}`}
              >
                {formatPct(coverageTotal.functions.pct)}
              </div>
              <div className="text-xs text-text-tertiary">
                {coverageTotal.functions.covered}/{coverageTotal.functions.total}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
              <div className="text-xs text-text-tertiary">Lines</div>
              <div
                className={`text-lg font-semibold ${getPctClass(coverageTotal.lines.pct)}`}
              >
                {formatPct(coverageTotal.lines.pct)}
              </div>
              <div className="text-xs text-text-tertiary">
                {coverageTotal.lines.covered}/{coverageTotal.lines.total}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-text-primary">文件摘要</div>
          <div className="text-xs text-text-tertiary">
            共 {fileEntries.length} 个文件
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border/70">
          <div className="h-full overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-surface-secondary">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-medium text-text-secondary">
                    <SortHeader label="File" activeKey="name" />
                  </th>
                  <th className="px-3 py-2 font-medium text-text-secondary">
                    <SortHeader label="Tests" activeKey="tests" />
                  </th>
                  <th className="px-3 py-2 font-medium text-text-secondary">
                    <SortHeader label="Passed" activeKey="passed" />
                  </th>
                  <th className="px-3 py-2 font-medium text-text-secondary">
                    <SortHeader label="Failed" activeKey="failed" />
                  </th>
                  <th className="hidden px-3 py-2 font-medium text-text-secondary lg:table-cell">
                    <SortHeader label="Skipped" activeKey="skipped" />
                  </th>
                  <th className="hidden px-3 py-2 font-medium text-text-secondary lg:table-cell">
                    <SortHeader label="Duration" activeKey="duration" />
                  </th>
                  <th className="px-3 py-2 font-medium text-text-secondary">
                    <SortHeader label="Statements" activeKey="statements" />
                  </th>
                  <th className="hidden px-3 py-2 font-medium text-text-secondary xl:table-cell">
                    <SortHeader label="Branches" activeKey="branches" />
                  </th>
                  <th className="hidden px-3 py-2 font-medium text-text-secondary xl:table-cell">
                    <SortHeader label="Functions" activeKey="functions" />
                  </th>
                  <th className="hidden px-3 py-2 font-medium text-text-secondary xl:table-cell">
                    <SortHeader label="Lines" activeKey="lines" />
                  </th>
                  <th className="px-3 py-2 font-medium text-text-secondary">
                    <span className="text-xs font-medium">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => (
                  <tr
                    key={entry.path}
                    className="border-b border-border/70 last:border-b-0 hover:bg-surface-secondary/40"
                  >
                    <td
                      className="max-w-[220px] truncate px-3 py-2 font-mono text-text-primary sm:max-w-[300px]"
                      title={entry.path}
                    >
                      {entry.name}
                    </td>
                    <td className="px-3 py-2 text-text-primary">{entry.tests}</td>
                    <td className="px-3 py-2 text-success">{entry.passed}</td>
                    <td
                      className={`px-3 py-2 ${
                        entry.failed > 0 ? "text-danger" : "text-text-primary"
                      }`}
                    >
                      {entry.failed}
                    </td>
                    <td className="hidden px-3 py-2 text-text-secondary lg:table-cell">
                      {entry.skipped}
                    </td>
                    <td className="hidden px-3 py-2 text-text-secondary lg:table-cell">
                      {entry.durationMs > 0 ? formatDuration(entry.durationMs) : "-"}
                    </td>
                    <td className="px-3 py-2">
                      <CoveragePctCell pct={entry.coverage?.statements.pct} />
                    </td>
                    <td className="hidden px-3 py-2 xl:table-cell">
                      <CoveragePctCell pct={entry.coverage?.branches.pct} />
                    </td>
                    <td className="hidden px-3 py-2 xl:table-cell">
                      <CoveragePctCell pct={entry.coverage?.functions.pct} />
                    </td>
                    <td className="hidden px-3 py-2 xl:table-cell">
                      <CoveragePctCell pct={entry.coverage?.lines.pct} />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedFilePath(entry.path)}
                        className="inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-xs font-medium text-text-primary transition-colors hover:bg-surface-secondary"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        查看
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {!coverageTotal && resultSummary ? (
          <div className="rounded-lg border border-border/70 bg-surface-secondary/40 px-3 py-4 text-sm text-text-secondary">
            当前只找到了测试结果，覆盖率明细报告不可用。
          </div>
        ) : null}
      </Card>

      <ModalShell
        open={Boolean(selectedEntry)}
        title={selectedEntry ? `${selectedEntry.name} · 测试详情` : undefined}
        width={920}
        maxHeight={720}
        onClose={() => setSelectedFilePath(null)}
      >
        {selectedEntry ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                <div className="text-xs text-text-tertiary">Tests</div>
                <div className="text-lg font-semibold text-text-primary">
                  {selectedEntry.tests}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                <div className="text-xs text-text-tertiary">Passed</div>
                <div className="text-lg font-semibold text-success">
                  {selectedEntry.passed}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                <div className="text-xs text-text-tertiary">Failed</div>
                <div
                  className={`text-lg font-semibold ${
                    selectedEntry.failed > 0 ? "text-danger" : "text-text-primary"
                  }`}
                >
                  {selectedEntry.failed}
                </div>
              </div>
              <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                <div className="text-xs text-text-tertiary">Duration</div>
                <div className="text-lg font-semibold text-text-primary">
                  {selectedEntry.durationMs > 0
                    ? formatDuration(selectedEntry.durationMs)
                    : "-"}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-surface-secondary/40 px-3 py-3 text-xs text-text-secondary">
              <div className="font-mono text-text-primary">{selectedEntry.path}</div>
            </div>

            <div className="space-y-3">
              {selectedEntry.coverage && selectedCoverageFile ? (
                <div className="rounded-lg border border-border/70 bg-surface-secondary/30 px-3 py-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">
                        覆盖率明细
                      </div>
                      <div className="text-xs text-text-tertiary">
                        没有独立测试记录时，也会保留该文件的覆盖率诊断信息。
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                      <div className="text-xs text-text-tertiary">Statements</div>
                      <div
                        className={`text-lg font-semibold ${getPctClass(selectedEntry.coverage.statements.pct)}`}
                      >
                        {formatPct(selectedEntry.coverage.statements.pct)}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {selectedEntry.coverage.statements.covered}/
                        {selectedEntry.coverage.statements.total}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                      <div className="text-xs text-text-tertiary">Branches</div>
                      <div
                        className={`text-lg font-semibold ${getPctClass(selectedEntry.coverage.branches.pct)}`}
                      >
                        {formatPct(selectedEntry.coverage.branches.pct)}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {selectedEntry.coverage.branches.covered}/
                        {selectedEntry.coverage.branches.total}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                      <div className="text-xs text-text-tertiary">Functions</div>
                      <div
                        className={`text-lg font-semibold ${getPctClass(selectedEntry.coverage.functions.pct)}`}
                      >
                        {formatPct(selectedEntry.coverage.functions.pct)}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {selectedEntry.coverage.functions.covered}/
                        {selectedEntry.coverage.functions.total}
                      </div>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
                      <div className="text-xs text-text-tertiary">Lines</div>
                      <div
                        className={`text-lg font-semibold ${getPctClass(selectedEntry.coverage.lines.pct)}`}
                      >
                        {formatPct(selectedEntry.coverage.lines.pct)}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {selectedEntry.coverage.lines.covered}/
                        {selectedEntry.coverage.lines.total}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <div className="rounded-lg border border-border/70 bg-surface-primary px-3 py-3">
                      <div className="text-xs font-medium text-text-primary">
                        执行命中概览
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-secondary">
                        <div>
                          行命中: {countCoveredHits(selectedCoverageFile.lines.hits)}
                        </div>
                        <div>
                          行未命中: {countUncoveredHits(selectedCoverageFile.lines.hits)}
                        </div>
                        <div>
                          语句命中:{" "}
                          {countCoveredHits(selectedCoverageFile.statements.hits)}
                        </div>
                        <div>
                          语句未命中:{" "}
                          {countUncoveredHits(selectedCoverageFile.statements.hits)}
                        </div>
                        <div>
                          函数命中:{" "}
                          {countCoveredHits(selectedCoverageFile.functions.hits)}
                        </div>
                        <div>
                          函数未命中:{" "}
                          {countUncoveredHits(selectedCoverageFile.functions.hits)}
                        </div>
                        <div>
                          分支未命中: {uncoveredBranches.length}
                        </div>
                        <div>
                          分支总数: {selectedCoverageFile.branches.length}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-surface-primary px-3 py-3">
                      <div className="text-xs font-medium text-text-primary">
                        未覆盖线索
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-text-secondary">
                        <div>
                          <span className="font-medium text-text-primary">Lines:</span>{" "}
                          {uncoveredLines.length > 0 ? uncoveredLines.join(", ") : "无"}
                        </div>
                        <div>
                          <span className="font-medium text-text-primary">
                            Statements:
                          </span>{" "}
                          {uncoveredStatements.length > 0
                            ? uncoveredStatements.join(", ")
                            : "无"}
                        </div>
                        <div>
                          <span className="font-medium text-text-primary">
                            Functions:
                          </span>{" "}
                          {uncoveredFunctions.length > 0
                            ? uncoveredFunctions.join(", ")
                            : "无"}
                        </div>
                        <div>
                          <span className="font-medium text-text-primary">
                            Branches:
                          </span>{" "}
                          {uncoveredBranches.length > 0
                            ? uncoveredBranches.join(" | ")
                            : "无"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {selectedEntry.suites.length > 0 ? (
                selectedEntry.suites.map((suite) => (
                  <div
                    key={suite.absoluteName || suite.name}
                    className="rounded-lg border border-border/70"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-border/70 px-3 py-2.5">
                      <div className="min-w-0">
                        <div
                          className="truncate font-mono text-xs font-medium text-text-primary"
                          title={suite.absoluteName || suite.name}
                        >
                          {suite.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                          <span>{suite.assertionResults.length} tests</span>
                          <span>{formatDuration(getSuiteDuration(suite))}</span>
                        </div>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium ${getStatusClass(suite.status)}`}
                      >
                        {suite.status}
                      </span>
                    </div>

                    <div className="space-y-2 px-3 py-3">
                      {suite.assertionResults.map((test) => (
                        <div
                          key={test.fullName}
                          className="rounded-md border border-border/70 bg-surface-secondary/45 px-2.5 py-2"
                        >
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <span
                              className="truncate text-xs text-text-primary"
                              title={test.fullName}
                            >
                              {test.fullName}
                            </span>
                            <span
                              className={`shrink-0 text-[11px] font-medium ${getStatusClass(test.status)}`}
                            >
                              {test.status}
                              {typeof test.duration === "number"
                                ? ` · ${formatDuration(test.duration)}`
                                : ""}
                            </span>
                          </div>
                          {test.failureMessages.length > 0 ? (
                            <pre className="mt-2 max-h-[160px] overflow-auto whitespace-pre-wrap rounded border border-danger/20 bg-danger-soft px-2 py-1.5 text-[11px] leading-4 text-danger-text">
                              {test.failureMessages.join("\n\n")}
                            </pre>
                          ) : null}
                        </div>
                      ))}

                      {suite.message ? (
                        <pre className="max-h-[120px] overflow-auto whitespace-pre-wrap rounded border border-border bg-surface-secondary px-2 py-1 text-[11px] leading-4 text-text-secondary">
                          {suite.message}
                        </pre>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : selectedEntry.coverage ? (
                <div className="rounded-lg border border-border/70 bg-surface-secondary/40 px-3 py-4 text-sm text-text-secondary">
                  当前文件没有独立测试用例记录，已展示覆盖率诊断信息。
                </div>
              ) : (
                <div className="rounded-lg border border-border/70 bg-surface-secondary/40 px-3 py-4 text-sm text-text-secondary">
                  当前文件没有可展示的测试明细。
                </div>
              )}
            </div>
          </div>
        ) : null}
      </ModalShell>
    </>
  );
}
