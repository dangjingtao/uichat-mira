import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownAZ,
  ArrowUpZA,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import Card from "./Card";

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
  branchesTrue?: CoverageMetric;
}

export type CoverageSummary = Record<string, CoverageEntry>;

export interface TestResultSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failedTests: string[];
}

export interface CoverageReportPanelProps {
  /** coverage-summary.json 的完整 URL */
  src: string;
  /** test-results-summary.json 的完整 URL */
  resultSrc?: string;
  /** 面板标题 */
  title?: React.ReactNode;
  /** 报告不存在时的提示文案 */
  emptyText?: React.ReactNode;
  /** 加载失败时的提示文案 */
  errorText?: React.ReactNode;
  className?: string;
}

type LoadState =
  | { status: "checking" }
  | { status: "ready"; data: CoverageSummary }
  | { status: "empty" }
  | { status: "error"; error: string };

type ResultLoadState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "ready"; data: TestResultSummary }
  | { status: "empty" }
  | { status: "error"; error: string };

type SortKey = "name" | "statements" | "branches" | "functions" | "lines";
type SortOrder = "asc" | "desc";

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
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

function CoveragePctCell({ pct }: { pct: number }) {
  return (
    <div className="flex min-w-[72px] flex-col gap-1">
      <span className={`font-medium ${getPctClass(pct)}`}>
        {formatPct(pct)}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-secondary">
        <div
          className={`h-full rounded-full transition-all ${getPctBarClass(pct)}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
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
  const [state, setState] = useState<LoadState>({ status: "checking" });
  const [resultState, setResultState] = useState<ResultLoadState>(
    resultSrc ? { status: "checking" } : { status: "idle" },
  );
  const [sortKey, setSortKey] = useState<SortKey>("statements");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    let cancelled = false;
    setState({ status: "checking" });

    fetch(src)
      .then(async (res) => {
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setState({ status: "empty" });
          return;
        }
        const data = (await res.json()) as CoverageSummary;
        if (!data || typeof data !== "object" || !data.total) {
          setState({ status: "empty" });
          return;
        }
        setState({ status: "ready", data });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
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
        const data = (await res.json()) as TestResultSummary;
        if (!data || typeof data !== "object") {
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

  const total = state.status === "ready" ? state.data.total : null;

  const fileEntries = useMemo(() => {
    if (state.status !== "ready") {
      return [];
    }
    return Object.entries(state.data)
      .filter(([key]) => key !== "total")
      .map(([path, entry]) => ({
        path,
        name: path.split(/[/\\]/).pop() || path,
        statements: entry.statements.pct,
        branches: entry.branches.pct,
        functions: entry.functions.pct,
        lines: entry.lines.pct,
      }));
  }, [state]);

  const sortedEntries = useMemo(() => {
    const sorted = [...fileEntries];
    sorted.sort((a, b) => {
      const factor = sortOrder === "asc" ? 1 : -1;
      if (sortKey === "name") {
        return factor * a.name.localeCompare(b.name);
      }
      return factor * (a[sortKey] - b[sortKey]);
    });
    return sorted;
  }, [fileEntries, sortKey, sortOrder]);

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
  }: {
    label: string;
    activeKey: SortKey;
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
        }`}
      >
        {label}
        {active ? <Icon className="h-3 w-3" /> : null}
      </button>
    );
  };

  if (state.status === "checking") {
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

  if (state.status === "error") {
    return (
      <Card className={`space-y-3 ${className}`}>
        {title ? (
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        ) : null}
        <div className="flex h-[200px] flex-col items-center justify-center gap-1 text-sm text-danger">
          <span>{errorText}</span>
          <span className="text-xs text-text-tertiary">{state.error}</span>
        </div>
      </Card>
    );
  }

  if (state.status === "empty" || !total) {
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

  const resultSummary =
    resultState.status === "ready" ? resultState.data : null;

  return (
    <Card className={`flex h-full flex-col space-y-4 ${className}`}>
      {title ? (
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      ) : null}

      {resultSummary ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {resultSummary.failed > 0 ? (
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
                {resultSummary.total}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
              <div className="text-xs text-text-tertiary">
                {t("settings.development.testResults.passed")}
              </div>
              <div className="text-lg font-semibold text-success">
                {resultSummary.passed}
              </div>
            </div>
            <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
              <div className="text-xs text-text-tertiary">
                {t("settings.development.testResults.failed")}
              </div>
              <div
                className={`text-lg font-semibold ${
                  resultSummary.failed > 0 ? "text-danger" : "text-text-primary"
                }`}
              >
                {resultSummary.failed}
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

          {resultSummary.failedTests.length > 0 ? (
            <div className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-danger">
                <XCircle className="h-3.5 w-3.5" />
                {t("settings.development.testResults.failedTests")}
              </div>
              <ul className="max-h-[120px] overflow-y-auto space-y-1">
                {resultSummary.failedTests.map((name) => (
                  <li
                    key={name}
                    className="truncate font-mono text-xs text-danger-text"
                    title={name}
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
          <div className="text-xs text-text-tertiary">Statements</div>
          <div
            className={`text-lg font-semibold ${getPctClass(total.statements.pct)}`}
          >
            {formatPct(total.statements.pct)}
          </div>
          <div className="text-xs text-text-tertiary">
            {total.statements.covered}/{total.statements.total}
          </div>
        </div>
        <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
          <div className="text-xs text-text-tertiary">Branches</div>
          <div
            className={`text-lg font-semibold ${getPctClass(total.branches.pct)}`}
          >
            {formatPct(total.branches.pct)}
          </div>
          <div className="text-xs text-text-tertiary">
            {total.branches.covered}/{total.branches.total}
          </div>
        </div>
        <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
          <div className="text-xs text-text-tertiary">Functions</div>
          <div
            className={`text-lg font-semibold ${getPctClass(total.functions.pct)}`}
          >
            {formatPct(total.functions.pct)}
          </div>
          <div className="text-xs text-text-tertiary">
            {total.functions.covered}/{total.functions.total}
          </div>
        </div>
        <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-2">
          <div className="text-xs text-text-tertiary">Lines</div>
          <div
            className={`text-lg font-semibold ${getPctClass(total.lines.pct)}`}
          >
            {formatPct(total.lines.pct)}
          </div>
          <div className="text-xs text-text-tertiary">
            {total.lines.covered}/{total.lines.total}
          </div>
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
                  <SortHeader label="Statements" activeKey="statements" />
                </th>
                <th className="px-3 py-2 font-medium text-text-secondary">
                  <SortHeader label="Branches" activeKey="branches" />
                </th>
                <th className="hidden px-3 py-2 font-medium text-text-secondary sm:table-cell">
                  <SortHeader label="Functions" activeKey="functions" />
                </th>
                <th className="hidden px-3 py-2 font-medium text-text-secondary sm:table-cell">
                  <SortHeader label="Lines" activeKey="lines" />
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
                    className="max-w-[200px] truncate px-3 py-2 font-mono text-text-primary sm:max-w-[300px]"
                    title={entry.path}
                  >
                    {entry.name}
                  </td>
                  <td className="px-3 py-2">
                    <CoveragePctCell pct={entry.statements} />
                  </td>
                  <td className="px-3 py-2">
                    <CoveragePctCell pct={entry.branches} />
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    <CoveragePctCell pct={entry.functions} />
                  </td>
                  <td className="hidden px-3 py-2 sm:table-cell">
                    <CoveragePctCell pct={entry.lines} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-text-tertiary">
        共 {fileEntries.length} 个文件 · 点击表头可排序
      </div>
    </Card>
  );
}
