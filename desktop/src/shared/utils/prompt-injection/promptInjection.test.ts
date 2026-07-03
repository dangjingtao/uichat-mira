import assert from "node:assert/strict";
import { test } from "vitest";
import type { ChatMessage } from "@/shared/uchat/core/types";
import {
  buildPromptInjectionMessages,
  estimatePromptMessageTokens,
} from "./promptInjection";

const createMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: overrides.id ?? "message-1",
  threadId: overrides.threadId ?? "thread-1",
  role: overrides.role ?? "user",
  parts: overrides.parts ?? [{ type: "text", text: "hello" }],
  createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
  parentId: overrides.parentId ?? null,
  status: overrides.status ?? "complete",
  metadata: overrides.metadata,
  errorMessage: overrides.errorMessage,
});

test("prompt injection builds pre-history and in-history messages from frontend thread history", () => {
  const history = [
    createMessage({
      id: "u1",
      role: "user",
      parts: [{ type: "text", text: "First question" }],
    }),
    createMessage({
      id: "a1",
      role: "assistant",
      parts: [{ type: "text", text: "First answer" }],
    }),
    createMessage({
      id: "u2",
      role: "user",
      parts: [{ type: "text", text: "Latest question" }],
    }),
  ];

  const result = buildPromptInjectionMessages(
    [
      {
        identifier: "persona",
        order: 1,
        parts: [{ type: "text", text: "You are {{char}} helping {{user}}." }],
      },
      {
        identifier: "memory",
        position: "in-history",
        depth: 1,
        order: 5,
        parts: [{ type: "text", text: "Relevant memory: {{memory}}" }],
      },
    ],
    {
      history,
      variables: {
        char: "Aileen",
        user: "Tom",
        memory: "The latest issue affects only premium users.",
      },
    },
  );

  assert.deepEqual(
    result.messages.map((message) => ({
      role: message.role,
      parts: message.parts,
    })),
    [
      {
        role: "system",
        parts: [{ type: "text", text: "You are Aileen helping Tom." }],
      },
      {
        role: "user",
        parts: [{ type: "text", text: "First question" }],
      },
      {
        role: "assistant",
        parts: [{ type: "text", text: "First answer" }],
      },
      {
        role: "system",
        parts: [
          {
            type: "text",
            text: "Relevant memory: The latest issue affects only premium users.",
          },
        ],
      },
      {
        role: "user",
        parts: [{ type: "text", text: "Latest question" }],
      },
    ],
  );
  assert.deepEqual(result.debug.map((entry) => entry.origin), [
    "prompt",
    "history",
    "history",
    "injection",
    "history",
  ]);
});

test("prompt injection filters disabled entries and generation triggers", () => {
  const history = [createMessage()];

  const result = buildPromptInjectionMessages(
    [
      {
        identifier: "disabled",
        enabled: false,
        parts: [{ type: "text", text: "Should not render" }],
      },
      {
        identifier: "regen-only",
        triggers: ["regenerate"],
        parts: [{ type: "text", text: "Should not render in normal mode" }],
      },
      {
        identifier: "normal",
        triggers: ["normal"],
        parts: [{ type: "text", text: "Render in normal mode" }],
      },
    ],
    {
      history,
      generationType: "normal",
    },
  );

  assert.equal(result.messages.length, 2);
  assert.deepEqual(result.messages[0]?.parts, [
    { type: "text", text: "Render in normal mode" },
  ]);
});

test("prompt injection trims history to budget and preserves the latest user message", () => {
  const firstUser = createMessage({
    id: "u1",
    role: "user",
    parts: [{ type: "text", text: "11111111111111111111" }],
  });
  const assistant = createMessage({
    id: "a1",
    role: "assistant",
    parts: [{ type: "text", text: "22222222222222222222" }],
  });
  const latestUser = createMessage({
    id: "u2",
    role: "user",
    parts: [{ type: "text", text: "33333333333333333333" }],
  });

  const result = buildPromptInjectionMessages(
    [
      {
        identifier: "persona",
        parts: [{ type: "text", text: "system prompt" }],
      },
    ],
    {
      history: [firstUser, assistant, latestUser],
      latestUserMessage: latestUser,
      budget: {
        maxContextTokens: 12,
        reserveResponseTokens: 2,
      },
    },
  );

  assert.equal(result.messages[0]?.role, "system");
  assert.equal(result.messages.some((message) => message.id === "u2"), true);
  assert.equal(result.messages.some((message) => message.id === "u1"), false);
  assert.equal(result.messages.some((message) => message.id === "a1"), false);
});

test("prompt injection recursively renders template strings in data parts and metadata", () => {
  const result = buildPromptInjectionMessages(
    [
      {
        identifier: "rag",
        metadata: {
          source: "{{sourceName}}",
        },
        parts: [
          {
            type: "data",
            name: "rag-source",
            value: {
              title: "{{sourceName}}",
              labels: ["{{labelA}}", "{{labelB}}"],
            },
          },
        ],
      },
    ],
    {
      history: [],
      variables: {
        sourceName: "Doc Alpha",
        labelA: "internal",
        labelB: "verified",
      },
    },
  );

  assert.deepEqual(result.messages, [
    {
      role: "system",
      metadata: {
        source: "Doc Alpha",
      },
      parts: [
        {
          type: "data",
          name: "rag-source",
          value: {
            title: "Doc Alpha",
            labels: ["internal", "verified"],
          },
        },
      ],
    },
  ]);
});

test("prompt injection supports future field injection through extensions", () => {
  const result = buildPromptInjectionMessages(
    [
      {
        identifier: "persona",
        parts: [{ type: "text", text: "Assistant prompt" }],
      },
    ],
    {
      history: [],
      extensions: [
        {
          apply({ entry, message, origin }) {
            return {
              ...message,
              name: `${origin}:${entry.identifier}`,
              annotations: {
                injected: true,
              },
            };
          },
        },
      ],
    },
  );

  assert.deepEqual(result.messages, [
    {
      role: "system",
      name: "prompt:persona",
      annotations: {
        injected: true,
      },
      parts: [{ type: "text", text: "Assistant prompt" }],
    },
  ]);
});

test("prompt token estimate reflects all rendered parts", () => {
  const tokens = estimatePromptMessageTokens({
    role: "system",
    parts: [
      { type: "text", text: "abcdefgh" },
      { type: "file", source: "/f.txt", mimeType: "text/plain", name: "f.txt" },
      { type: "data", name: "meta", value: { a: 1 } },
    ],
  });

  assert.equal(tokens > 0, true);
});
