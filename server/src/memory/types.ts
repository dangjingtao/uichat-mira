export type MemoryKind = "preference" | "fact" | "decision" | "constraint";

export interface ConversationMemorySource {
  type: "conversation";
  threadId: string;
  userMessageId: string;
  assistantMessageId: string;
}

export interface ManualMemorySource {
  type: "manual";
  operationId: string;
}

export type MemorySource = ConversationMemorySource | ManualMemorySource;

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  content: string;
  sources: MemorySource[];
  createdAt: string;
  updatedAt: string;
}

export type MemoryPatchProposal =
  | {
      operation: "create";
      kind: MemoryKind;
      content: string;
      confidence: number;
      reason: string;
    }
  | {
      operation: "replace";
      targetId: string;
      kind: MemoryKind;
      content: string;
      confidence: number;
      reason: string;
    }
  | {
      operation: "delete";
      targetId: string;
      confidence: number;
      reason: string;
    };

export type ValidatedMemoryPatch =
  | {
      operation: "create";
      record: MemoryRecord;
      reason: string;
    }
  | {
      operation: "replace";
      targetId: string;
      record: MemoryRecord;
      reason: string;
    }
  | {
      operation: "delete";
      targetId: string;
      reason: string;
    };

export interface ConsolidationInput {
  userId: number;
  source: ConversationMemorySource;
  userText: string;
  assistantText: string;
  existing: MemoryRecord[];
}

export interface MemoryConsolidator {
  propose(input: ConsolidationInput): Promise<MemoryPatchProposal[]>;
}

export interface MemoryTurnLedger {
  has(userId: number, source: ConversationMemorySource): Promise<boolean>;
  mark(userId: number, source: ConversationMemorySource): Promise<void>;
}

export interface MemorySettings {
  enabled: boolean;
}

export interface MemoryContextSnapshot {
  content: string;
  updatedAt: string | null;
  recordCount: number;
}

export interface MemoryApplyResult {
  created: number;
  replaced: number;
  deleted: number;
}

export interface MemoryOverviewRecord {
  id: string;
  kind: MemoryKind;
  content: string;
  origin: MemorySource["type"];
  createdAt: string;
  updatedAt: string;
}

export interface MemoryOverview {
  enabled: boolean;
  records: MemoryOverviewRecord[];
}
