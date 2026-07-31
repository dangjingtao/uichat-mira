import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "vitest";
import { FileMemoryRepository } from "./file-memory.repository.js";
import { MemoryService } from "./memory.service.js";
import type { MemoryConsolidator } from "./types.js";

const roots: string[] = [];

const createRoot = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-memory-service-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("MemoryService", () => {
  it("commits a validated proposal and recalls it synchronously", async () => {
    const root = await createRoot();
    const consolidator: MemoryConsolidator = {
      async propose() {
        return [
          {
            operation: "create",
            kind: "preference",
            content: "用户偏好先看明确结论，再展开理由。",
            confidence: 0.98,
            reason: "用户明确表达",
          },
        ];
      },
    };
    const service = new MemoryService(
      new FileMemoryRepository(root),
      consolidator,
    );

    const result = await service.commitTurn({
      userId: 1,
      source: {
        threadId: "thread-1",
        userMessageId: "user-1",
        assistantMessageId: "assistant-1",
      },
      userText: "以后技术问题先给我结论。",
      assistantText: "记住了。",
    });

    assert.deepEqual(result, { created: 1, replaced: 0, deleted: 0 });

    const snapshot = service.buildContextSync(1);
    assert.equal(snapshot.recordCount, 1);
    assert.match(snapshot.content, /偏好/);
    assert.match(snapshot.content, /先看明确结论/);
    assert.ok(snapshot.updatedAt);
  });

  it("does not call the consolidator for an incomplete turn", async () => {
    const root = await createRoot();
    let calls = 0;
    const consolidator: MemoryConsolidator = {
      async propose() {
        calls += 1;
        return [];
      },
    };
    const service = new MemoryService(
      new FileMemoryRepository(root),
      consolidator,
    );

    const result = await service.commitTurn({
      userId: 1,
      source: {
        threadId: "thread-1",
        userMessageId: "user-1",
        assistantMessageId: "assistant-1",
      },
      userText: "",
      assistantText: "answer",
    });

    assert.equal(calls, 0);
    assert.deepEqual(result, { created: 0, replaced: 0, deleted: 0 });
  });
});
