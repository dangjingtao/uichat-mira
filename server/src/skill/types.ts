export type SkillInstanceStatus =
  | "created"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface SkillSemanticPolicy {
  purpose: string;
  usageGuidance: string;
  decisionPolicy: string;
  qualityCriteria: string;
  completionCriteria: string[];
}

export interface SkillDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  semantics: SkillSemanticPolicy;
  allowedToolIds: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  stateSchema?: Record<string, unknown>;
  permissionRequirements?: Record<string, unknown>;
}

export interface SkillRuntimeFrame {
  skillId: string;
  skillVersion: string;
  skillInstanceId: string;
  stage?: string;
  semanticContext: string;
  completionCriteria: string[];
  qualityCriteria: string;
  allowedToolIds: string[];
}

export interface SkillEvidenceDelta {
  observations: unknown[];
  toolExecutions: unknown[];
  retrievals: unknown[];
  latestSummary?: unknown;
}

export type SkillRuntimeEvaluation =
  | { status: "running" }
  | { status: "waiting"; reason: string }
  | { status: "completed"; output: unknown }
  | { status: "failed"; reason: string };

export interface SkillRuntimeAdapter {
  initialize(input: unknown): unknown;
  getRuntimeFrame(input: {
    instance: SkillInstance;
    definition: SkillDefinition;
  }): Omit<SkillRuntimeFrame, "skillId" | "skillVersion" | "skillInstanceId">;
  reduceEvidence(input: {
    state: unknown;
    evidence: SkillEvidenceDelta;
    instance: SkillInstance;
    definition: SkillDefinition;
  }): unknown;
  evaluate(input: {
    state: unknown;
    instance: SkillInstance;
    definition: SkillDefinition;
  }): SkillRuntimeEvaluation;
}

export interface SkillResolverContext {
  goalText: string;
  latestUserQuestion?: string;
  params?: Record<string, unknown>;
}

export interface SkillRegistration {
  definition: SkillDefinition;
  adapter: SkillRuntimeAdapter;
  match?: (context: SkillResolverContext) => number;
}

export interface SkillEvidenceCursor {
  observations: number;
  toolExecutions: number;
  retrievals: number;
}

export interface SkillInstance {
  id: string;
  runId: string;
  threadId: string;
  userId: number;
  skillId: string;
  skillVersion: string;
  status: SkillInstanceStatus;
  stage?: string;
  input: unknown;
  state: unknown;
  output?: unknown;
  artifactRefs: string[];
  checkpointRef?: string;
  error?: string;
  evidenceCursor: SkillEvidenceCursor;
  createdAt: string;
  updatedAt: string;
}

export interface SkillInstanceStore {
  create(input: {
    runId: string;
    threadId: string;
    userId: number;
    skillId: string;
    skillVersion: string;
    input: unknown;
    state: unknown;
  }): SkillInstance;
  get(instanceId: string): SkillInstance | undefined;
  getByRunId(runId: string): SkillInstance | undefined;
  update(
    instanceId: string,
    patch: Partial<Omit<SkillInstance, "id" | "createdAt">>,
  ): SkillInstance;
  clear(): void;
}
