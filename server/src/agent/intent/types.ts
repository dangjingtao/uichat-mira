import type { ProxyProviderParam } from "@/services/provider-proxy.service/index.js";
import type {
  HarnessToolCandidate,
  HarnessToolExposure,
} from "@/mcp/harness/tool-candidates.js";

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

export interface ToolIntentCandidate {
  toolId: string;
  title: string;
  description: string;
  score: number;
  embeddingScore: number;
  ruleScore: number;
  rerankScore?: number;
  finalScore?: number;
  source: "internal" | "external";
  domain: string;
  tags: string[];
  actionProfileId?: string;
  actionProfileTitle?: string;
  actionProfileDescription?: string;
  preferredForQuery?: boolean;
  reason?: string;
}

export interface ToolIntentResult {
  query: string;
  topCandidates: ToolIntentCandidate[];
  toolCandidates: HarnessToolCandidate[];
  toolExposure: HarnessToolExposure;
  selectedToolIds: string[];
  candidateToolIds: string[];
  exposureReasons?: string[];
  decisionSource?: "task-model" | "rule" | "guard";
  decisionReason?: string;
  retrievalModel?: {
    provider?: string;
    model?: string;
    modelConfigId?: string;
  };
  rerankModel?: {
    model?: string;
    modelConfigId?: string;
  };
}

export type CapabilityIntentCandidate = ToolIntentCandidate;
