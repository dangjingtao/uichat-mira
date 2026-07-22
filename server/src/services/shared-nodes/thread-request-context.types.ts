export type RequestContextThread = {
  roleId: string | null;
  contextSummary: string | null;
  contextSummaryUpdatedAt: string | null;
  memoryContext?: string | null;
  memoryContextUpdatedAt?: string | null;
  agentEnabled?: boolean | null;
  executionEnvironment?: {
    platform: NodeJS.Platform;
    shellFamily: "powershell" | "cmd" | "posix";
    shellExecutable: string;
    workspaceRoot: string | null;
    cwd: string | null;
    availableTools: string[];
  } | null;
};

export type RequestContextMessage = {
  role: "system";
  content: string;
  requestContextScope?: "agent-execution";
};

export type RequestContextExecutionNode = {
  nodeId: string;
  nodeType: "context" | "memory";
  phase: "start" | "done" | "error";
  label: string;
  summary?: string;
  details?: Record<string, unknown>;
};

export type RequestContextResolver = (input: {
  thread: RequestContextThread;
  userId: number;
}) => {
  message: RequestContextMessage | null;
  executionNode?: RequestContextExecutionNode | null;
} | null;
