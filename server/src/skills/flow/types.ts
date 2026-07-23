import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";

export type SkillDirectivePhase = "collecting" | "final_confirmation" | "ready";

export type SkillRequirementKind =
  | "user_input"
  | "evidence"
  | "resource"
  | "capability";

export type SkillRequirement = {
  id: string;
  kind: SkillRequirementKind;
  description: string;
  requiredFor: string;
  acceptedFormats?: string[];
  alternatives?: string[];
};

export type SkillInterruption = {
  reason:
    | "missing_requirement"
    | "waiting_for_evidence"
    | "recoverable_dependency";
  requirements: SkillRequirement[];
};

export type SkillDirective = {
  skillId: string;
  sessionId: string;
  phase: SkillDirectivePhase;
  flowCompleted: boolean;
  round?: number;
  maxRounds?: number;
  /**
   * Structured execution interruption. It reports missing external conditions
   * only; Planner remains the sole owner of ask_user and user-facing wording.
   */
  interruption?: SkillInterruption;
  /** @deprecated Read-only compatibility for sessions persisted before interruption. */
  requiredAction?: "ask_user";
  /** @deprecated Read-only compatibility for sessions persisted before interruption. */
  question?: string;
  next?: {
    intent: string;
    targetSkillId?: string;
    args?: Record<string, unknown>;
  };
  stateRef?: string;
  /**
   * Internal deterministic delivery payload. It is intentionally excluded from
   * Planner prompt serialization; Planner only sees whether delivery is ready.
   */
  delivery?: {
    kind: "markdown" | "inline_html";
    /** Short text fallback delivered as the assistant text answer. */
    content: string;
    /** Deterministic HTML report rendered from the same structured state. */
    inlineHtml?: string;
    reportTitle?: string;
    pdf?: {
      available: boolean;
      fileName: string;
      error?: string;
    };
  };
};

export type PlannerSkillDirective = Omit<SkillDirective, "delivery"> & {
  /** Planner-visible fact only; the delivery body remains private to Generate. */
  deliveryReady: boolean;
};

export type StoredSkillFlowSession = {
  sessionId: string;
  threadId: string;
  userId: number;
  skillId: string;
  skillVersion: string;
  status: "collecting" | "final_confirmation" | "ready" | "cancelled" | "failed";
  round: number;
  maxRounds: number;
  state: Record<string, unknown>;
  lastDirective?: SkillDirective;
  processedMessageIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SkillFlowRuntimeInput = {
  session: StoredSkillFlowSession;
  threadId: string;
  userId: number;
  userMessageId: string;
  query: string;
  messages: NormalizedChatMessage[];
};

export type SkillFlowRuntimeResult = {
  session: StoredSkillFlowSession;
  directive: SkillDirective;
  requestContextMessages?: NormalizedChatMessage[];
};

export type SkillConversationFlowRuntime = {
  skillId: string;
  version: string;
  maxRounds: number;
  createInitialState(): Record<string, unknown>;
  processTurn(input: SkillFlowRuntimeInput): Promise<SkillFlowRuntimeResult>;
};

export type SkillDirectiveHandoffRuntime = {
  skillId: string;
  version: string;
  execute(input: {
    session: StoredSkillFlowSession;
    sourceDirective: SkillDirective;
    args: Record<string, unknown>;
  }): Promise<SkillFlowRuntimeResult>;
};

export const toPlannerSkillDirective = (
  directive: SkillDirective | undefined,
): PlannerSkillDirective | undefined => {
  if (!directive) return undefined;
  const { delivery, ...plannerDirective } = directive;
  return {
    ...plannerDirective,
    deliveryReady: Boolean(delivery?.content),
  };
};
