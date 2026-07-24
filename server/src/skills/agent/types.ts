import type { SkillContext } from "@/skills/context/types.js";

export type SkillAgentExecutionStatus =
  | "completed"
  | "insufficient_evidence"
  | "needs_input"
  | "failed";

export type SkillAgentRuntimeBinding = {
  id: string;
  kind: "skill-private-runtime";
  status: "ready" | "pending";
  description: string;
};

export type SkillAgentExecutionProfile = {
  skillId: string;
  mode: "forked-agent";
  engine: "pi-agent-core";
  allowedHarnessToolIds: string[];
  runtimeBindings: SkillAgentRuntimeBinding[];
  workspaceBound: true;
};

export type SkillAgentRequirement = {
  id: string;
  kind: "user_input" | "evidence" | "resource" | "capability" | "approval";
  description: string;
  requiredFor: string;
};

export type SkillAgentExecutionResult = {
  status: SkillAgentExecutionStatus;
  summary?: string;
  evidence: unknown[];
  artifacts: unknown[];
  missingEvidence?: unknown[];
  requirements?: SkillAgentRequirement[];
  recoverable?: boolean;
  error?: string;
  trace?: {
    engine: "pi-agent-core";
    skillId: string;
    toolCalls: string[];
  };
};

export type SkillAgentApprovedInvocation = {
  toolId: string;
  inputHash: string;
};

export type SkillAgentExecutionInput = {
  goal: string;
  skillContext: SkillContext;
  workspaceRoot: string;
  userId?: number;
  threadId?: string;
  turnId?: string;
  approvedInvocations?: SkillAgentApprovedInvocation[];
};

export type SkillAgentToolBinding = {
  id: string;
  label: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<{
    result?: unknown;
    evidence?: unknown;
    artifacts?: unknown[];
    terminate?: boolean;
    requirement?: SkillAgentRequirement;
  }>;
};
