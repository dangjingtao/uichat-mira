import { readFileSync, statSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  MemoryApplyResult,
  MemoryKind,
  MemoryRecord,
  MemorySource,
  ValidatedMemoryPatch,
} from "./types.js";

const MEMORY_BLOCK_START = "<!-- mira:memory";
const MEMORY_BLOCK_END = "<!-- /mira:memory -->";
const DEFAULT_DOCUMENT = "# Mira Memory\n\n";
const MAX_SYNC_DOCUMENT_BYTES = 256 * 1024;

type ParsedMemoryBlock = {
  record: MemoryRecord;
  start: number;
  end: number;
};

type MemoryBlockMetadata = Omit<MemoryRecord, "content">;

type MemoryTombstone = {
  id: string;
  content: string;
  normalizedContent: string;
  deletedAt: string;
};

const isMemoryKind = (value: unknown): value is MemoryKind =>
  value === "preference" ||
  value === "fact" ||
  value === "decision" ||
  value === "constraint";

const isMemorySource = (value: unknown): value is MemorySource => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const source = value as Partial<MemorySource>;
  return (
    typeof source.threadId === "string" &&
    typeof source.userMessageId === "string" &&
    typeof source.assistantMessageId === "string"
  );
};

const parseMetadata = (raw: string): MemoryBlockMetadata | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<MemoryBlockMetadata>;
    if (
      typeof parsed.id !== "string" ||
      !isMemoryKind(parsed.kind) ||
      !Array.isArray(parsed.sources) ||
      !parsed.sources.every(isMemorySource) ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.updatedAt !== "string"
    ) {
      return null;
    }
    return {
      id: parsed.id,
      kind: parsed.kind,
      sources: parsed.sources,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
};

export const parseMemoryDocument = (document: string): ParsedMemoryBlock[] => {
  const blocks: ParsedMemoryBlock[] = [];
  let cursor = 0;

  while (cursor < document.length) {
    const start = document.indexOf(MEMORY_BLOCK_START, cursor);
    if (start < 0) break;

    const metadataStart = start + MEMORY_BLOCK_START.length;
    const metadataEnd = document.indexOf("-->", metadataStart);
    if (metadataEnd < 0) break;

    const blockEndStart = document.indexOf(MEMORY_BLOCK_END, metadataEnd + 3);
    if (blockEndStart < 0) break;

    const end = blockEndStart + MEMORY_BLOCK_END.length;
    const metadata = parseMetadata(
      document.slice(metadataStart, metadataEnd).trim(),
    );
    const content = document.slice(metadataEnd + 3, blockEndStart).trim();

    if (metadata && content) {
      blocks.push({
        record: {
          ...metadata,
          content,
        },
        start,
        end,
      });
    }

    cursor = end;
  }

  return blocks;
};

export const renderMemoryBlock = (record: MemoryRecord) => {
  const metadata: MemoryBlockMetadata = {
    id: record.id,
    kind: record.kind,
    sources: record.sources,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };

  return `${MEMORY_BLOCK_START}\n${JSON.stringify(metadata)}\n-->\n${record.content.trim()}\n${MEMORY_BLOCK_END}`;
};

const normalizeContent = (value: string) =>
  value.trim().toLocaleLowerCase().replaceAll(/\s+/g, " ");

const readTextFile = async (filePath: string, fallback = "") => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
};

const appendJsonLine = async (filePath: string, value: unknown) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
};

const atomicWrite = async (filePath: string, content: string) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(temporaryPath, content, "utf8");
  try {
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
};

export class FileMemoryRepository {
  private readonly writeQueues = new Map<number, Promise<void>>();

  constructor(private readonly rootDir: string) {}

  private userDir(userId: number) {
    return path.join(this.rootDir, "users", String(userId));
  }

  private memoryPath(userId: number) {
    return path.join(this.userDir(userId), "MEMORY.md");
  }

  private journalPath(userId: number) {
    return path.join(this.userDir(userId), ".meta", "journal.jsonl");
  }

  private tombstonePath(userId: number) {
    return path.join(this.userDir(userId), ".meta", "tombstones.jsonl");
  }

  private runSerialized<T>(userId: number, operation: () => Promise<T>): Promise<T> {
    const previous = this.writeQueues.get(userId) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(operation);
    this.writeQueues.set(
      userId,
      current.then(
        () => undefined,
        () => undefined,
      ),
    );
    return current;
  }

  listSync(userId: number): MemoryRecord[] {
    try {
      const memoryPath = this.memoryPath(userId);
      const stat = statSync(memoryPath);
      if (stat.size > MAX_SYNC_DOCUMENT_BYTES) return [];
      return parseMemoryDocument(readFileSync(memoryPath, "utf8")).map(
        (block) => block.record,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  updatedAtSync(userId: number): string | null {
    try {
      return statSync(this.memoryPath(userId)).mtime.toISOString();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  async list(userId: number): Promise<MemoryRecord[]> {
    const document = await readTextFile(this.memoryPath(userId), DEFAULT_DOCUMENT);
    return parseMemoryDocument(document).map((block) => block.record);
  }

  async updatedAt(userId: number): Promise<string | null> {
    try {
      const stat = await fs.stat(this.memoryPath(userId));
      return stat.mtime.toISOString();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null;
      }
      throw error;
    }
  }

  private async listTombstones(userId: number): Promise<MemoryTombstone[]> {
    const raw = await readTextFile(this.tombstonePath(userId));
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .flatMap((line) => {
        try {
          const parsed = JSON.parse(line) as MemoryTombstone;
          return typeof parsed.normalizedContent === "string" ? [parsed] : [];
        } catch {
          return [];
        }
      });
  }

  async apply(
    userId: number,
    patches: ValidatedMemoryPatch[],
  ): Promise<MemoryApplyResult> {
    return this.runSerialized(userId, async () => {
      let document = await readTextFile(this.memoryPath(userId), DEFAULT_DOCUMENT);
      const tombstones = await this.listTombstones(userId);
      const result: MemoryApplyResult = { created: 0, replaced: 0, deleted: 0 };
      const journalEntries: unknown[] = [];
      const newTombstones: MemoryTombstone[] = [];

      for (const patch of patches) {
        const blocks = parseMemoryDocument(document);

        if (patch.operation === "create") {
          const normalized = normalizeContent(patch.record.content);
          const alreadyExists = blocks.some(
            (block) => normalizeContent(block.record.content) === normalized,
          );
          const wasDeleted = tombstones.some(
            (tombstone) => tombstone.normalizedContent === normalized,
          );
          if (alreadyExists || wasDeleted) continue;

          document = `${document.trimEnd()}\n\n${renderMemoryBlock(patch.record)}\n`;
          result.created += 1;
          journalEntries.push({
            operation: patch.operation,
            record: patch.record,
            reason: patch.reason,
            committedAt: new Date().toISOString(),
          });
          continue;
        }

        const target = blocks.find((block) => block.record.id === patch.targetId);
        if (!target) continue;

        if (patch.operation === "replace") {
          document =
            document.slice(0, target.start) +
            renderMemoryBlock(patch.record) +
            document.slice(target.end);
          result.replaced += 1;
          journalEntries.push({
            operation: patch.operation,
            previous: target.record,
            record: patch.record,
            reason: patch.reason,
            committedAt: new Date().toISOString(),
          });
          continue;
        }

        document = document.slice(0, target.start) + document.slice(target.end);
        const deletedAt = new Date().toISOString();
        newTombstones.push({
          id: target.record.id,
          content: target.record.content,
          normalizedContent: normalizeContent(target.record.content),
          deletedAt,
        });
        result.deleted += 1;
        journalEntries.push({
          operation: patch.operation,
          previous: target.record,
          reason: patch.reason,
          committedAt: deletedAt,
        });
      }

      if (result.created + result.replaced + result.deleted === 0) {
        return result;
      }

      await atomicWrite(this.memoryPath(userId), `${document.trimEnd()}\n`);
      for (const tombstone of newTombstones) {
        await appendJsonLine(this.tombstonePath(userId), tombstone);
      }
      for (const entry of journalEntries) {
        await appendJsonLine(this.journalPath(userId), entry);
      }

      return result;
    });
  }
}
