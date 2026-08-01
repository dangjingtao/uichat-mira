import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "vitest";
import { FileMemoryRepository } from "./file-memory.repository.js";
import { FileMemoryTurnLedger } from "./file-memory-turn-ledger.js";
import { MemoryService } from "./memory.service.js";
import type {
  ConversationMemorySource,
  MemoryConsolidator,
} from "./types.js";

const roots: string[] = [];

const createRoot = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-memory-service-"));
  roots.push(root);
  return root;
};

const createConversationSource = (
  suffix: string,
): ConversationMemorySource => ({
  type: "conversation",
  threadId: `thread-${suffix}`,
  userMessageId: `user-${suffix}`,
  assistantMessageId: `assistant-${suffix}`,
});

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("MemoryService", () => {
  it("commits a validated proposal once and recalls it synchronously", async () => {
    const root = await createRoot();
    let calls = 0;
    const consolidator: MemoryConsolidator = {
      async propose() {
        calls += 1;
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
      new FileMemoryTurnLedger(root),
    );
    const turn = {
      userId: 1,
      source: createConversationSource("1"),
      userText: "以后技术问题先给我结论。",
      assistantText: "记住了。",
    };

    const result = await service.commitTurn(turn);
    const duplicateResult = await service.commitTurn(turn);

    assert.deepEqual(result, { created: 1, replaced: 0, deleted: 0 });
    assert.deepEqual(duplicateResult, { created: 0, replaced: 0, deleted: 0 });
    assert.equal(calls, 1);

    const snapshot = service.buildContextSync(1);
    assert.equal(snapshot.recordCount, 1);
    assert.match(snapshot.content, /偏好/);
    assert.match(snapshot.content, /先看明确结论/);
    assert.ok(snapshot.updatedAt);

    const processedTurns = await fs.readFile(
      path.join(root, "users", "1", ".meta", "processed-turns.jsonl"),
      "utf8",
    );
    assert.match(processedTurns, /thread-1:user-1:assistant-1/);
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
      new FileMemoryTurnLedger(root),
    );

    const result = await service.commitTurn({
      userId: 1,
      source: createConversationSource("1"),
      userText: "",
      assistantText: "answer",
    });

    assert.equal(calls, 0);
    assert.deepEqual(result, { created: 0, replaced: 0, deleted: 0 });
  });

  it("marks no-op consolidation as processed", async () => {
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
      new FileMemoryTurnLedger(root),
    );
    const turn = {
      userId: 1,
      source: createConversationSource("2"),
      userText: "帮我算一下这道题。",
      assistantText: "答案是 42。",
    };

    await service.commitTurn(turn);
    await service.commitTurn(turn);

    assert.equal(calls, 1);
  });

  it("disables recall and automatic consolidation while preserving turn idempotency", async () => {
    const root = await createRoot();
    const repository = new FileMemoryRepository(root);
    let calls = 0;
    const consolidator: MemoryConsolidator = {
      async propose() {
        calls += 1;
        return [];
      },
    };
    const service = new MemoryService(
      repository,
      consolidator,
      new FileMemoryTurnLedger(root),
    );
    await repository.updateSettings(1, { enabled: false });

    const turn = {
      userId: 1,
      source: createConversationSource("disabled"),
      userText: "以后记住这个偏好。",
      assistantText: "好的。",
    };
    await service.commitTurn(turn);
    await service.setEnabled(1, true);
    await service.commitTurn(turn);

    assert.equal(calls, 0);
    assert.deepEqual(service.buildContextSync(1), {
      content: "",
      updatedAt: null,
      recordCount: 0,
    });
  });

  it("creates, edits and deletes memories through the manual management contract", async () => {
    const root = await createRoot();
    const service = new MemoryService(
      new FileMemoryRepository(root),
      { async propose() { return []; } },
      new FileMemoryTurnLedger(root),
    );

    const created = await service.createManual(1, {
      kind: "preference",
      content: "用户希望技术讨论先给结论。",
    });
    assert.equal(created.records.length, 1);
    assert.equal(created.records[0]?.origin, "manual");

    const id = created.records[0]!.id;
    const updated = await service.updateManual(1, id, {
      kind: "constraint",
      content: "技术讨论必须先给结论，再展开理由。",
    });
    assert.equal(updated?.records[0]?.kind, "constraint");
    assert.match(updated?.records[0]?.content ?? "", /必须先给结论/);

    const deleted = await service.deleteManual(1, id);
    assert.deepEqual(deleted?.records, []);
    assert.equal(await service.updateManual(1, "missing", {
      kind: "fact",
      content: "不存在的记忆。",
    }), null);
  });
});
