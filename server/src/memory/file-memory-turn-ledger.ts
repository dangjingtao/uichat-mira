import fs from "node:fs/promises";
import path from "node:path";
import type { MemorySource, MemoryTurnLedger } from "./types.js";

type ProcessedTurnEntry = {
  key: string;
  source: MemorySource;
  processedAt: string;
};

const sourceKey = (source: MemorySource) =>
  `${source.threadId}:${source.userMessageId}:${source.assistantMessageId}`;

const readTextFile = async (filePath: string) => {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return "";
    }
    throw error;
  }
};

export class FileMemoryTurnLedger implements MemoryTurnLedger {
  constructor(private readonly rootDir: string) {}

  private ledgerPath(userId: number) {
    return path.join(
      this.rootDir,
      "users",
      String(userId),
      ".meta",
      "processed-turns.jsonl",
    );
  }

  async has(userId: number, source: MemorySource): Promise<boolean> {
    const expectedKey = sourceKey(source);
    const raw = await readTextFile(this.ledgerPath(userId));

    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .some((line) => {
        try {
          const parsed = JSON.parse(line) as Partial<ProcessedTurnEntry>;
          return parsed.key === expectedKey;
        } catch {
          return false;
        }
      });
  }

  async mark(userId: number, source: MemorySource): Promise<void> {
    const filePath = this.ledgerPath(userId);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const entry: ProcessedTurnEntry = {
      key: sourceKey(source),
      source,
      processedAt: new Date().toISOString(),
    };
    await fs.appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}
