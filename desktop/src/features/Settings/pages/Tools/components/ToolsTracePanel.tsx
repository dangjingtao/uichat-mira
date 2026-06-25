import { Radar } from "lucide-react";
import TerminalPanel from "@/shared/ui/TerminalPanel";
import type { McpArtifact, McpInvocationEvent } from "@/shared/api/tools";
import { compactJson } from "../utils";

type ToolsTracePanelProps = {
  activeToolId: string | null;
  artifacts: McpArtifact[];
  events: McpInvocationEvent[];
  emptyPlaceholder: string;
  panelTitle: string;
  runError: string | null;
};

export default function ToolsTracePanel({
  activeToolId,
  artifacts,
  events,
  emptyPlaceholder,
  panelTitle,
  runError,
}: ToolsTracePanelProps) {
  const eventLines = events.map((event) => {
    if (event.type === "invocation:start") {
      return `${event.at}  start  ${event.toolId}`;
    }
    if (event.type === "invocation:approval_required") {
      return `${event.at}  approval  ${event.message}${event.scope ? `  [${event.scope}]` : ""}`;
    }
    if (event.type === "invocation:progress") {
      return `${event.at}  progress  ${event.message}`;
    }
    if (event.type === "invocation:stdout") {
      return `${event.at}  ${event.stream}  ${event.chunk}`;
    }
    if (event.type === "invocation:artifact") {
      const data =
        typeof event.artifact.data === "string"
          ? event.artifact.data
          : event.artifact.data
            ? compactJson(event.artifact.data)
            : "";
      return `${event.at}  artifact  ${event.artifact.kind}  ${event.artifact.title}${data ? `\n${data}` : ""}`;
    }
    if (event.type === "invocation:result") {
      return `${event.at}  result\n${compactJson(event.result)}`;
    }
    if (event.type === "invocation:error") {
      return `${event.at}  error  ${event.message}`;
    }
    if (event.type === "invocation:finish") {
      return `${event.at}  finish  ${event.status}`;
    }
    return "";
  });

  return (
    <TerminalPanel
      title={panelTitle}
      badge={
        <div className="flex items-center gap-2 text-[11px] text-text-secondary">
          <Radar className="h-3.5 w-3.5" />
          <span>{artifacts.length} artifacts</span>
        </div>
      }
      meta={activeToolId ?? "tool stream"}
      className="h-full min-h-0 rounded-ui-control"
    >
      {runError ? (
        <div className="whitespace-pre-wrap break-words text-sm text-danger-text">{runError}</div>
      ) : eventLines.length > 0 ? (
        <div className="space-y-3 whitespace-pre-wrap break-words text-[12px]">
          {eventLines.map((line, index) => (
            <div key={`${line}-${index}`}>{line}</div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-text-secondary">{emptyPlaceholder}</div>
      )}
    </TerminalPanel>
  );
}
