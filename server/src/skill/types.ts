export type SkillInstanceStatus =
  | "created"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled";

export interface SkillSemanticDefinition {
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
  inputSchema?: unknown;
  outputSchema?: unknown;
  stateSchema?: unknown;
  semantics: SkillSemanticDefinition;
  /**
   * Maximum tool boundary for the Skill. Runtime stages may narrow this list,
   * but a Skill can never expand the Harness exposure surface.
   */
  allowedToolIds: string[];
  permissionRequirements?: unknown;
}

export interface SkillRuntimeFrame {
  skillId: string;
  skillVersion: string;
  skillInstanceId: string;
  name: string;
  status: SkillInstanceStatus;
  stage?: string;
  semanticContext: string;
  allowedToolIds: string[];
  completionCriteria: string[];
  qualityCriteria: string;
}

export interface SkillCheckpoint {
  sequence: number;
  createdAt: string;
}

export interface SkillInstance<State = unknown, Input = unknown, Output = unknown> {
  id: string;
  skillId: string;
  skillVersion: string;
  status: SkillInstanceStatus;
  stage?: string;
  input: Input;
  state: State;
  output?: Output;
  artifactRefs: string[];
  checkpoint: SkillCheckpoint;
  error?: {
    message: string;
    code?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export type SkillRuntimeEvaluation<Output = unknown> =
  | { status: "running" }
  | { status: "waiting"; reason: string }
  | { status: "completed"; output: Output }
  | { status: "failed"; reason: string; code?: string };

export interface SkillRuntimeAdapter<State = unknown, Input = unknown, Output = unknown> {
  initialize(input: Input): State | Promise<State>;
  getRuntimeFrame(state: State): {
    stage?: string;
    semanticContext?: string;
    /** Optional stage-local narrowing of SkillDefinition.allowedToolIds. */
    allowedToolIds?: string[];
    completionCriteria?: string[];
  };
  reduceEvidence(state: State, evidence: SkillEvidenceInput): State | Promise<State>;
  evaluate(state: State): SkillRuntimeEvaluation<Output> | Promise<SkillRuntimeEvaluation<Output>>;
}

export interface SkillActivationContext {
  runId: string;
  goalText: string;
  latestUserText?: string;
  params?: Record<string, unknown>;
  currentTaskFrame?: unknown;
}

export type SkillMatcher = (
  context: SkillActivationContext,
) => boolean | number | Promise<boolean | number>;

export interface SkillRegistration<
  State = unknown,
  Input = unknown,
  Output = unknown,
> {
  definition: SkillDefinition;
  adapter: SkillRuntimeAdapter<State, Input, Output>;
  match?: SkillMatcher;
  activationThreshold?: number;
  createInput?: (context: SkillActivationContext) => Input | Promise<Input>;
}

export interface SkillEvidenceInput {
  evidence: unknown;
  latestEvidenceSummary?: unknown;
  latestToolExecution?: unknown;
}

export interface SkillRunBinding {
  resolutionAttempted: boolean;
  resolvedSkillIds: string[];
  instance?: SkillInstance;
  lastInstance?: SkillInstance;
}
