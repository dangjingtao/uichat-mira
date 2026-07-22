import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";

export type ContextBudgetPolicyName =
  | "plain-chat"
  | "rag-chat"
  | "task-chat"
  | "agent-generate";

export interface ContextBudgetPolicy {
  name: ContextBudgetPolicyName;
  modelContextTokens: number;
  reservedOutputTokens: number;
  prefaceMaxTokens: number;
  instructionMaxTokens: number;
  payloadMaxTokens: number;
  historyMaxTokens: number;
}

export interface ContextBudgetPayload<TMeta = unknown> {
  id: string;
  messages: NormalizedChatMessage[];
  metadata?: TMeta;
  maxTokens?: number;
  required?: boolean;
}

export interface ContextBudgetPackInput {
  policy: ContextBudgetPolicyName;
  roleType: "llm" | "task" | "evaluation";
  providerCode?: string;
  model?: string;
  params?: Record<string, unknown>;
  sections: {
    prefaceMessages?: NormalizedChatMessage[];
    instructionMessages?: NormalizedChatMessage[];
    payloads?: ContextBudgetPayload[];
    historyMessages?: NormalizedChatMessage[];
    latestUserMessage: NormalizedChatMessage;
  };
}

export interface ContextBudgetAuditSection {
  name: string;
  beforeTokens: number;
  afterTokens: number;
  action: "kept" | "trimmed" | "dropped";
  reason?: string;
}

export interface ContextBudgetAudit {
  policy: ContextBudgetPolicyName;
  model: string;
  providerCode: string;
  modelContextTokens: number;
  reservedOutputTokens: number;
  maxInputTokens: number;
  totalEstimatedTokensBefore: number;
  totalEstimatedTokensAfter: number;
  sections: ContextBudgetAuditSection[];
  warnings: string[];
}

export interface PackedContextPayload<TMeta = unknown> {
  id: string;
  messages: NormalizedChatMessage[];
  metadata?: TMeta;
}

export interface ContextBudgetPackResult {
  messages: NormalizedChatMessage[];
  payloads: PackedContextPayload[];
  audit: ContextBudgetAudit;
}
