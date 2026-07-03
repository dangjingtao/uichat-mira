import type {
  McpArtifact,
  McpInvocationEvent,
  McpToolDomain,
  McpToolDefinition,
  McpWorkspaceSelection,
} from "@/shared/api/tools";

export type ToolWorkbenchDomain = Extract<
  McpToolDomain,
  "read" | "edit" | "web_search" | "terminal" | "browser_action"
>;

export type ToolDomainSummary = {
  id: ToolWorkbenchDomain;
  label: string;
  description: string;
  count: number;
};

export type WorkbenchToolDefinition = McpToolDefinition & {
  source: "internal";
  domain: ToolWorkbenchDomain;
};

export type ToolsWorkbenchState = {
  activeDomain: ToolWorkbenchDomain;
  selectedToolId: string | null;
  argsDraft: string;
  isRunning: boolean;
  isLoading: boolean;
  isWorkspaceLoading: boolean;
  isSelectingWorkspace: boolean;
  tools: WorkbenchToolDefinition[];
  workspaceSelection: McpWorkspaceSelection | null;
  workspaceRootInput: string;
  events: McpInvocationEvent[];
  result: unknown;
  artifacts: McpArtifact[];
  runError: string | null;
  runStatus: "idle" | "completed" | "failed" | "cancelled";
};
