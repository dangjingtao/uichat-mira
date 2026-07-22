import type {
  McpArtifact,
  McpInvocationEvent,
  McpToolDefinition,
  McpWorkspaceSelection,
} from "@/shared/api/tools";

export type ToolWorkbenchGroupId = string;

export type ToolGroupSummary = {
  id: ToolWorkbenchGroupId;
  label: string;
  description: string;
  count: number;
  order: number;
  icon: string;
};

export type WorkbenchToolDefinition = McpToolDefinition & {
  source: "internal";
  workbench: NonNullable<McpToolDefinition["workbench"]>;
};

export type ToolsWorkbenchState = {
  activeGroupId: ToolWorkbenchGroupId;
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
