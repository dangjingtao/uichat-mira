import path from "node:path";
import CONFIG from "@/config/index.js";
import { FileMemoryRepository } from "./file-memory.repository.js";
import { LlmMemoryConsolidator } from "./llm-memory.consolidator.js";
import { validateMemoryPatchProposals } from "./memory-policy.js";
import type {
  MemoryApplyResult,
  MemoryConsolidator,
  MemoryContextSnapshot,
  MemorySource,
} from "./types.js";

const MAX_CONTEXT_RECORDS = 40;
const MAX_CONTEXT_CHARACTERS = 6000;

const KIND_LABELS = {
  preference: "偏好",
  fact: "长期事实",
  decision: "决定",
  constraint: "约束",
} as const;

export class MemoryService {
  constructor(
    private readonly repository: FileMemoryRepository,
    private readonly consolidator: MemoryConsolidator,
  ) {}

  async buildContext(userId: number): Promise<MemoryContextSnapshot> {
    const records = (await this.repository.list(userId)).toSorted((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
    const lines: string[] = [];
    let length = 0;

    for (const record of records.slice(0, MAX_CONTEXT_RECORDS)) {
      const line = `- [${KIND_LABELS[record.kind]}] ${record.content}`;
      const nextLength = length + line.length + (lines.length > 0 ? 1 : 0);
      if (nextLength > MAX_CONTEXT_CHARACTERS) break;
      lines.push(line);
      length = nextLength;
    }

    return {
      content: lines.join("\n"),
      updatedAt: await this.repository.updatedAt(userId),
      recordCount: lines.length,
    };
  }

  async commitTurn(input: {
    userId: number;
    source: MemorySource;
    userText: string;
    assistantText: string;
  }): Promise<MemoryApplyResult> {
    const userText = input.userText.trim();
    const assistantText = input.assistantText.trim();
    if (!userText || !assistantText) {
      return { created: 0, replaced: 0, deleted: 0 };
    }

    const existing = await this.repository.list(input.userId);
    const proposals = await this.consolidator.propose({
      userId: input.userId,
      source: input.source,
      userText,
      assistantText,
      existing,
    });
    const patches = validateMemoryPatchProposals({
      proposals,
      existing,
      source: input.source,
    });

    if (patches.length === 0) {
      return { created: 0, replaced: 0, deleted: 0 };
    }

    return this.repository.apply(input.userId, patches);
  }
}

const memoryRoot = path.resolve(CONFIG.DATABASE_DIR, "memory");

export const memoryService = new MemoryService(
  new FileMemoryRepository(memoryRoot),
  new LlmMemoryConsolidator(),
);
