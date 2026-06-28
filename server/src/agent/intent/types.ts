import type { ProxyProviderParam } from "@/services/provider-proxy.service/index.js";

export interface AgentIntentEmbeddingConfig {
  requestedProvider?: ProxyProviderParam;
  topK?: number;
  minScore?: number;
}

export interface CapabilityIntentDocument {
  capabilityId: string;
  title: string;
  text: string;
  source: "internal" | "external";
  domain: string;
  tags: string[];
}

export interface CapabilityIntentCandidate {
  capabilityId: string;
  title: string;
  score: number;
  source: "internal" | "external";
  domain: string;
  tags: string[];
}

export interface CapabilityIntentResult {
  query: string;
  topCandidates: CapabilityIntentCandidate[];
  selectedCapabilityIds: string[];
  retrievalModel?: {
    provider?: string;
    model?: string;
    modelConfigId?: string;
  };
}
