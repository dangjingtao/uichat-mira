import type {
  McpArtifact,
  McpInvocationEvent,
  McpToolDefinition,
  McpWorkspaceSelection,
} from "@/shared/api/tools";

export type ToolWorkbenchDomain =
  | "read"
  | "edit"
  | "web_search"
  | "terminal"
  | "browser_action";

export type ToolDomainSummary = {
  id: ToolWorkbenchDomain;
  label: string;
  description: string;
  count: number;
};

export type ToolsWorkbenchState = {
  activeDomain: ToolWorkbenchDomain;
  selectedToolId: string | null;
  argsDraft: string;
  isRunning: boolean;
  isLoading: boolean;
  isWorkspaceLoading: boolean;
  isSelectingWorkspace: boolean;
  tools: McpToolDefinition[];
  workspaceSelection: McpWorkspaceSelection | null;
  workspaceRootInput: string;
  events: McpInvocationEvent[];
  result: unknown;
  artifacts: McpArtifact[];
  runError: string | null;
  runStatus: "idle" | "completed" | "failed" | "cancelled";
};
