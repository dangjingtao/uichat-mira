export type MemoryKind = "preference" | "fact" | "decision" | "constraint";

export interface MemorySource {
  threadId: string;
  userMessageId: string;
  assistantMessageId: string;
}

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
  source: MemorySource;
  userText: string;
  assistantText: string;
  existing: MemoryRecord[];
}

export interface MemoryConsolidator {
  propose(input: ConsolidationInput): Promise<MemoryPatchProposal[]>;
}

export interface MemoryTurnLedger {
  has(userId: number, source: MemorySource): Promise<boolean>;
  mark(userId: number, source: MemorySource): Promise<void>;
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
