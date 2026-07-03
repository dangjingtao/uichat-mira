import type { ProxyProviderParam } from "@/services/provider-proxy.service/index.js";

export interface AgentIntentEmbeddingConfig {
  requestedProvider?: ProxyProviderParam;
  topK?: number;
  minScore?: number;
  selectedTopK?: number;
  selectedMinScore?: number;
}

export interface CapabilityIntentDocument {
  capabilityId: string;
  title: string;
  text: string;
  source: "internal" | "external";
  domain: string;
  tags: string[];
  preferredToolId?: string;
  supportingToolIds?: string[];
  actionProfileId?: string;
}

export interface CapabilityIntentCandidate {
  capabilityId: string;
  title: string;
  score: number;
  embeddingScore: number;
  ruleScore: number;
  rerankScore?: number;
  finalScore?: number;
  preferredToolId: string;
  supportingToolIds: string[];
  source: "internal" | "external";
  domain: string;
  tags: string[];
  actionProfileId?: string;
}

export interface CapabilityIntentResult {
  query: string;
  topCandidates: CapabilityIntentCandidate[];
  selectedCapabilityIds: string[];
  selectedToolIds: string[];
  exposureReasons?: string[];
  decisionSource?: "embedding" | "task-model" | "rule" | "guard";
  decisionReason?: string;
  retrievalModel?: {
    provider?: string;
    model?: string;
    modelConfigId?: string;
  };
}
