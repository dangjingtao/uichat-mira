import assert from "node:assert/strict";
import { test } from "vitest";
import { toUserMessageMetadata } from "./rag-message-metadata.js";
import {
  initializeAuthDatabase,
} from "@/db/auth.db";
import { initializeKnowledgeBaseDatabase } from "@/db/knowledge-base.db";
import { initializeModelConfigDatabase } from "@/db/model-config.db";
import { initializeRoleDatabase } from "@/db/role.db";
import { initializeThreadDatabase } from "@/db/thread.db";
import { userRepository } from "@/db/repositories";
import { threadService } from "@/services/thread.service.js";
import {
  generateThreadTitleFromMessages,
  getFallbackThreadTitle,
  getLatestUserTitleSeed,
  persistAssistantMessage,
  persistVisibleUserMessage,
  shouldGenerateTitle,
} from "./message-persistence.js";

const testDbPath = `file:${process.pid}-${Date.now()}-rag-message-metadata.sqlite`;

process.env.DATABASE_URL = testDbPath;

initializeAuthDatabase();
initializeModelConfigDatabase();
initializeKnowledgeBaseDatabase();
initializeRoleDatabase();
initializeThreadDatabase();

test("toUserMessageMetadata keeps lineage for mixed media messages", () => {
  assert.deepEqual(
    toUserMessageMetadata(
      {
        id: "user-1",
        role: "user",
        content: "Describe this\n[Image attachment: photo.webp (file-1)]",
        parts: [
          { type: "text", text: "Describe this" },
          {
            type: "image",
            image: "/attachments/photo.webp",
            filename: "photo.webp",
            fileId: "file-1",
            mediaType: "image/webp",
          },
        ],
      },
      "parent-1",
    ),
    {
      lineage: {
        parentId: "parent-1",
      },
    },
  );
});

test("toUserMessageMetadata keeps lineage for image-only messages", () => {
  assert.deepEqual(
    toUserMessageMetadata(
      {
        role: "user",
        content: "[Image attachment: image-1]",
        parts: [
          {
            type: "image",
            image: "data:image/png;base64,abc",
          },
        ],
      },
      null,
    ),
    {
      lineage: {
        parentId: null,
      },
    },
  );
});

test("toUserMessageMetadata writes lineage parentId independently", () => {
  assert.deepEqual(
    toUserMessageMetadata(
      {
        role: "user",
        content: "hello",
        parts: [{ type: "text", text: "hello" }],
      },
      "parent-2",
    ),
    {
      lineage: {
        parentId: "parent-2",
      },
    },
  );
});

test("toUserMessageMetadata omits legacy assistantUi for text-only messages", () => {
  assert.deepEqual(
    toUserMessageMetadata(
      {
        role: "user",
        content: "hello",
        parts: [{ type: "text", text: "hello" }],
      },
      null,
    ),
    {
      lineage: {
        parentId: null,
      },
    },
  );
});

test("toUserMessageMetadata maps file parts and image parts without ids", () => {
  assert.deepEqual(
    toUserMessageMetadata(
      {
        role: "user",
        content: "look",
        parts: [
          {
            type: "image",
            image: "/attachments/image.webp",
            filename: "image.webp",
          },
          {
            type: "file",
            filename: "image-file.webp",
            data: "/attachments/image-file.webp",
            mimeType: "image/webp",
          },
          {
            type: "file",
            filename: "doc.pdf",
            data: "/attachments/doc.pdf",
            mimeType: "application/pdf",
          },
        ],
      },
      "parent-3",
    ),
    {
      lineage: {
        parentId: "parent-3",
      },
    },
  );
});

test("persistAssistantMessage stores assistant text as canonical text parts", () => {
  const user = userRepository.create({
    username: `user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });
  const thread = threadService.createThread({
    userId: user.id,
  });

  persistAssistantMessage({
    threadId: thread.id,
    userId: user.id,
    assistantMessageId: `assistant-${crypto.randomUUID()}`,
    parentId: null,
    content: "hello assistant",
  });

  const nextThread = threadService.getThreadById(thread.id, user.id);
  assert.equal(nextThread?.messages[0]?.role, "assistant");
  assert.deepEqual(nextThread?.messages[0]?.parts, [
    { type: "text", text: "hello assistant" },
  ]);
});

test("persistAssistantMessage stores assistant execution-node parts when provided", () => {
  const user = userRepository.create({
    username: `user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });
  const thread = threadService.createThread({
    userId: user.id,
  });

  persistAssistantMessage({
    threadId: thread.id,
    userId: user.id,
    assistantMessageId: `assistant-${crypto.randomUUID()}-trace`,
    parentId: null,
    content: "done",
    parts: [
      { type: "text", text: "done" },
      {
        type: "data",
        name: "execution-node",
        value: {
          nodeId: "agent-generate",
          nodeType: "generate",
          phase: "done",
          label: "组织最终回答",
        },
      },
    ],
  });

  const nextThread = threadService.getThreadById(thread.id, user.id);
  assert.deepEqual(nextThread?.messages[0]?.parts, [
    { type: "text", text: "done" },
    {
      type: "data",
      name: "execution-node",
      value: {
        nodeId: "agent-generate",
        nodeType: "generate",
        phase: "done",
        label: "组织最终回答",
      },
    },
  ]);
});

test("persistAssistantMessage ignores empty assistant content", () => {
  const user = userRepository.create({
    username: `user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });
  const thread = threadService.createThread({
    userId: user.id,
  });

  persistAssistantMessage({
    threadId: thread.id,
    userId: user.id,
    assistantMessageId: `assistant-${crypto.randomUUID()}-empty`,
    parentId: null,
    content: "   ",
  });

  const nextThread = threadService.getThreadById(thread.id, user.id);
  assert.equal(nextThread?.messages.length, 0);
});

test("persistVisibleUserMessage persists latest user message and parent lineage", () => {
  const user = userRepository.create({
    username: `user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });
  const thread = threadService.createThread({
    userId: user.id,
  });
  const seed = threadService.createMessage(thread.id, user.id, {
    id: `seed-${crypto.randomUUID()}`,
    role: "assistant",
    content: "seed",
    parts: [{ type: "text", text: "seed" }],
  });

  const result = persistVisibleUserMessage({
    threadId: thread.id,
    userId: user.id,
    userMessageId: `user-${crypto.randomUUID()}`,
    messages: [
      {
        id: seed.id,
        role: "assistant",
        content: "seed",
        parts: [{ type: "text", text: "seed" }],
      },
      {
        id: `user-${crypto.randomUUID()}`,
        role: "user",
        content: "hello lineage",
        parts: [{ type: "text", text: "hello lineage" }],
      },
    ],
  });

  assert.equal(result.latestUserParentId, seed.id);
  assert.equal(result.latestUserMessage?.role, "user");
  const persistedMessage = threadService.getThreadById(thread.id, user.id)?.messages.at(-1);
  assert.equal(persistedMessage?.role, "user");
  assert.deepEqual(persistedMessage?.metadata, {
    lineage: {
      parentId: seed.id,
    },
  });
});

test("persistVisibleUserMessage rejects missing user content", () => {
  const user = userRepository.create({
    username: `user-${crypto.randomUUID()}`,
    passwordHash: "hash",
    role: "user",
    isActive: true,
  });
  const thread = threadService.createThread({
    userId: user.id,
  });

  assert.throws(
    () =>
      persistVisibleUserMessage({
        threadId: thread.id,
        userId: user.id,
        messages: [],
      }),
    /Latest user message is missing/,
  );
});

test("shouldGenerateTitle and generateThreadTitleFromMessages clean and trim model output", async () => {
  assert.equal(shouldGenerateTitle(undefined), true);
  assert.equal(shouldGenerateTitle("  新对话  "), true);
  assert.equal(shouldGenerateTitle("已有标题"), false);

  const title = await generateThreadTitleFromMessages({
    question: "问",
    answer: "答",
    streamTaskChatText: async function* () {
      yield '  "标题"  ';
      yield "继续";
    },
  });

  assert.equal(title, '标题"  继续');
});

test("getLatestUserTitleSeed falls back to image and file labels when text is empty", () => {
  assert.equal(
    getLatestUserTitleSeed({
      role: "user",
      content: "",
      parts: [
        {
          type: "image",
          image: "/attachments/photo.webp",
          filename: "photo.webp",
          mediaType: "image/webp",
        },
        {
          type: "file",
          filename: "report.pdf",
          data: "/attachments/report.pdf",
          mimeType: "application/pdf",
        },
      ],
    }),
    "[图片: photo.webp]\n[文件: report.pdf]",
  );
});

test("getFallbackThreadTitle prefers the user's first sentence", () => {
  assert.equal(
    getFallbackThreadTitle("第一句。第二句继续解释"),
    "第一句。",
  );
  assert.equal(
    getFallbackThreadTitle("   "),
    "新对话",
  );
  assert.equal(
    getFallbackThreadTitle("[图片: title-only.webp]"),
    "[图片: title-only.webp]",
  );
});
