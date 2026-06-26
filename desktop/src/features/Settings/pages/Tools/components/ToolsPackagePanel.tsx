import { LoaderCircle, Play, Settings2, Wrench } from "lucide-react";
import SegmentedTabs from "@/shared/ui/SegmentedTabs";
import Badge from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import type { McpToolDefinition } from "@/shared/api/tools";
import type { ReactNode } from "react";
import type { TerminalResultSummary } from "../utils";

type ToolsPackagePanelProps = {
  tools: McpToolDefinition[];
  selectedTool: McpToolDefinition | null;
  terminalSummary: TerminalResultSummary | null;
  runStatus: "idle" | "completed" | "failed" | "cancelled" | "awaiting_approval";
  isRunning: boolean;
  tracePanel: ReactNode;
  onSelectTool: (tool: McpToolDefinition) => void;
  onOpenArgsModal: () => void;
  onRun: () => void;
  labels: {
    empty: string;
    execute: string;
    config: string;
    packageTitle: string;
    packageDescription: string;
    terminalApprovalRequired: string;
    terminalTimeout: string;
    terminalReused: string;
    terminalExit: (exitCode: string) => string;
    terminalStreamMerged: string;
    terminalStreamSplit: string;
    terminalPtyMerged: string;
    terminalSession: (sessionId: string) => string;
    terminalCwd: (cwd: string) => string;
  };
};

export default function ToolsPackagePanel({
  tools,
  selectedTool,
  terminalSummary,
  runStatus,
  isRunning,
  tracePanel,
  onSelectTool,
  onOpenArgsModal,
  onRun,
  labels,
}: ToolsPackagePanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-ui-panel border border-border bg-surface-primary">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">{labels.packageTitle}</div>
            <div className="mt-1 text-sm text-text-secondary">{labels.packageDescription}</div>
          </div>
          <Badge variant="muted">{tools.length}</Badge>
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        {tools.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <SegmentedTabs
                items={tools.map((tool) => ({
                  value: tool.id,
                  label: tool.title,
                }))}
                value={selectedTool?.id ?? tools[0].id}
                onChange={(value) => {
                  const nextTool = tools.find((tool) => tool.id === value);
                  if (nextTool) {
                    onSelectTool(nextTool);
                  }
                }}
                className="min-w-0"
                size="sm"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={onOpenArgsModal}
                disabled={!selectedTool}
              >
                <Settings2 className="h-4 w-4" />
                {labels.config}
              </Button>
            </div>

            {selectedTool?.id === "terminal_session" && terminalSummary ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
                <Badge variant="muted">
                  {terminalSummary.streamMode === "merged"
                    ? labels.terminalStreamMerged
                    : labels.terminalStreamSplit}
                </Badge>
                <Badge variant="muted">{terminalSummary.sessionMode ?? "unknown mode"}</Badge>
                <Badge variant={terminalSummary.stderrSeparated === false ? "warning" : "muted"}>
                  {terminalSummary.stderrSeparated === false
                    ? labels.terminalPtyMerged
                    : labels.terminalStreamSplit}
                </Badge>
                {terminalSummary.sessionId ? (
                  <Badge variant="muted">
                    {labels.terminalSession(terminalSummary.sessionId)}
                  </Badge>
                ) : null}
                {terminalSummary.cwd ? (
                  <Badge variant="muted">{labels.terminalCwd(terminalSummary.cwd)}</Badge>
                ) : null}
                {terminalSummary.exitCode !== undefined ? (
                  <Badge variant="muted">
                    {labels.terminalExit(String(terminalSummary.exitCode))}
                  </Badge>
                ) : null}
                {terminalSummary.timedOut ? (
                  <Badge variant="warning">{labels.terminalTimeout}</Badge>
                ) : null}
                {terminalSummary.reusedSession ? (
                  <Badge variant="muted">{labels.terminalReused}</Badge>
                ) : null}
                {runStatus === "awaiting_approval" ? (
                  <Badge variant="warning">{labels.terminalApprovalRequired}</Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm text-text-secondary">{labels.empty}</div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
        <div className="min-h-0 flex-1 overflow-hidden">{tracePanel}</div>

        <div className="shrink-0 flex items-center justify-between gap-3 pt-4">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Wrench className="h-3.5 w-3.5" />
            <span>{selectedTool?.mode ?? "sync"}</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={onRun}
            disabled={isRunning || !selectedTool}
          >
            {isRunning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {labels.execute}
          </Button>
        </div>
      </div>
    </div>
  );
}
