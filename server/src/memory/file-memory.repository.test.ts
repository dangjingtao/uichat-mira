import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "vitest";
import { FileMemoryRepository } from "./file-memory.repository.js";
import type { MemoryRecord } from "./types.js";

const roots: string[] = [];

const createRoot = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mira-memory-"));
  roots.push(root);
  return root;
};

const createRecord = (content: string): MemoryRecord => ({
  id: "mem_test",
  kind: "preference",
  content,
  sources: [
    {
      type: "conversation",
      threadId: "thread-1",
      userMessageId: "user-1",
      assistantMessageId: "assistant-1",
    },
  ],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
});

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("FileMemoryRepository", () => {
  it("persists memory enablement with an enabled-by-default fallback", async () => {
    const root = await createRoot();
    const repository = new FileMemoryRepository(root);

    assert.deepEqual(repository.getSettingsSync(1), { enabled: true });
    assert.deepEqual(await repository.getSettings(1), { enabled: true });

    assert.deepEqual(await repository.updateSettings(1, { enabled: false }), {
      enabled: false,
    });
    assert.deepEqual(repository.getSettingsSync(1), { enabled: false });
    assert.deepEqual(await repository.getSettings(1), { enabled: false });
  });

  it("creates, replaces and deletes managed blocks without touching manual text", async () => {
    const root = await createRoot();
    const repository = new FileMemoryRepository(root);

    const created = createRecord("用户偏好先看结论。");
    assert.deepEqual(
      await repository.apply(1, [
        { operation: "create", record: created, reason: "explicit preference" },
      ]),
      { created: 1, replaced: 0, deleted: 0 },
    );

    const memoryPath = path.join(root, "users", "1", "MEMORY.md");
    await fs.appendFile(memoryPath, "\n用户手工维护的备注。\n", "utf8");

    const replacement: MemoryRecord = {
      ...created,
      content: "用户偏好先看明确结论，再展开理由。",
      updatedAt: "2026-08-01T01:00:00.000Z",
    };
    assert.deepEqual(
      await repository.apply(1, [
        {
          operation: "replace",
          targetId: created.id,
          record: replacement,
          reason: "user correction",
        },
      ]),
      { created: 0, replaced: 1, deleted: 0 },
    );
    assert.equal((await repository.list(1))[0]?.content, replacement.content);

    assert.deepEqual(
      await repository.apply(1, [
        { operation: "delete", targetId: created.id, reason: "user withdrew it" },
      ]),
      { created: 0, replaced: 0, deleted: 1 },
    );
    assert.deepEqual(await repository.list(1), []);

    const document = await fs.readFile(memoryPath, "utf8");
    assert.match(document, /用户手工维护的备注/);
    assert.doesNotMatch(document, /mira:memory/);

    const tombstones = await fs.readFile(
      path.join(root, "users", "1", ".meta", "tombstones.jsonl"),
      "utf8",
    );
    assert.match(tombstones, /用户偏好先看明确结论/);
    assert.match(tombstones, /user-1/);
  });

  it("blocks stale evidence replay but allows a new explicit source", async () => {
    const root = await createRoot();
    const repository = new FileMemoryRepository(root);
    const record = createRecord("不要自动打开网页。 ");

    await repository.apply(1, [
      { operation: "create", record, reason: "explicit constraint" },
    ]);
    await repository.apply(1, [
      { operation: "delete", targetId: record.id, reason: "withdrawn" },
    ]);

    const staleReplay = await repository.apply(1, [
      {
        operation: "create",
        record: { ...record, id: "mem_recreated" },
        reason: "stale replay",
      },
    ]);
    assert.deepEqual(staleReplay, { created: 0, replaced: 0, deleted: 0 });
    assert.deepEqual(await repository.list(1), []);

    const reaffirmed: MemoryRecord = {
      ...record,
      id: "mem_reaffirmed",
      sources: [
        {
          type: "conversation",
          threadId: "thread-2",
          userMessageId: "user-2",
          assistantMessageId: "assistant-2",
        },
      ],
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
    };
    const newSource = await repository.apply(1, [
      {
        operation: "create",
        record: reaffirmed,
        reason: "user explicitly reaffirmed it",
      },
    ]);

    assert.deepEqual(newSource, { created: 1, replaced: 0, deleted: 0 });
    assert.equal((await repository.list(1))[0]?.id, reaffirmed.id);
  });
});
