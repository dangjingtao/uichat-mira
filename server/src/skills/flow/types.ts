import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";

export type SkillDirectivePhase = "collecting" | "final_confirmation" | "ready";

export type SkillDirective = {
  skillId: string;
  sessionId: string;
  phase: SkillDirectivePhase;
  flowCompleted: boolean;
  round?: number;
  maxRounds?: number;
  requiredAction?: "ask_user";
  question?: string;
  next?: {
    intent: string;
    targetSkillId?: string;
    args?: Record<string, unknown>;
  };
  stateRef?: string;
  /**
   * Internal deterministic delivery payload. It is intentionally excluded from
   * Planner prompt serialization; Planner only sees the compact directive.
   */
  delivery?: {
    kind: "markdown" | "inline_html";
    content: string;
  };
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

export const toPlannerSkillDirective = (directive: SkillDirective | undefined) => {
  if (!directive) return undefined;
  const { delivery: _delivery, ...plannerDirective } = directive;
  return plannerDirective;
};
