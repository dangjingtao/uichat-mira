import { FileMemoryRepository } from "./file-memory.repository.js";
import { validateMemoryPatchProposals } from "./memory-policy.js";
import type {
  MemoryApplyResult,
  MemoryConsolidator,
  MemoryContextSnapshot,
  MemoryRecord,
  MemorySource,
  MemoryTurnLedger,
} from "./types.js";

const MAX_CONTEXT_RECORDS = 40;
const MAX_CONTEXT_CHARACTERS = 6000;
const EMPTY_APPLY_RESULT: MemoryApplyResult = {
  created: 0,
  replaced: 0,
  deleted: 0,
};

const KIND_LABELS = {
  preference: "偏好",
  fact: "长期事实",
  decision: "决定",
  constraint: "约束",
} as const;

const buildSnapshot = (
  records: MemoryRecord[],
  updatedAt: string | null,
): MemoryContextSnapshot => {
  const sorted = [...records].sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
  const lines: string[] = [];
  let length = 0;

  for (const record of sorted.slice(0, MAX_CONTEXT_RECORDS)) {
    const line = `- [${KIND_LABELS[record.kind]}] ${record.content}`;
    const nextLength = length + line.length + (lines.length > 0 ? 1 : 0);
    if (nextLength > MAX_CONTEXT_CHARACTERS) break;
    lines.push(line);
    length = nextLength;
  }

  return {
    content: lines.join("\n"),
    updatedAt,
    recordCount: lines.length,
  };
};

export class MemoryService {
  private readonly commitQueues = new Map<number, Promise<void>>();

  constructor(
    private readonly repository: FileMemoryRepository,
    private readonly consolidator: MemoryConsolidator,
    private readonly turnLedger: MemoryTurnLedger,
  ) {}

  private runCommitSerialized<T>(
    userId: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.commitQueues.get(userId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.commitQueues.set(
      userId,
      current.then(
        () => undefined,
        () => undefined,
      ),
    );
    return current;
  }

  buildContextSync(userId: number): MemoryContextSnapshot {
    return buildSnapshot(
      this.repository.listSync(userId),
      this.repository.updatedAtSync(userId),
    );
  }

  async buildContext(userId: number): Promise<MemoryContextSnapshot> {
    return buildSnapshot(
      await this.repository.list(userId),
      await this.repository.updatedAt(userId),
    );
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
      return { ...EMPTY_APPLY_RESULT };
    }

    return this.runCommitSerialized(input.userId, async () => {
      if (await this.turnLedger.has(input.userId, input.source)) {
        return { ...EMPTY_APPLY_RESULT };
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
      const result =
        patches.length > 0
          ? await this.repository.apply(input.userId, patches)
          : { ...EMPTY_APPLY_RESULT };

      await this.turnLedger.mark(input.userId, input.source);
      return result;
    });
  }
}
