import assert from "node:assert/strict";
import { test } from "vitest";
import {
  describeResolvedChatInvocation,
  trimHistoricalAttachmentsForProvider,
} from "./chat-adapters.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import type { ProviderResolution } from "./types.js";

test("trimHistoricalAttachmentsForProvider drops historical pure-image messages after attachment trimming", () => {
  const messages: NormalizedChatMessage[] = [
    {
      id: "first-user",
      role: "user",
      content: "",
      parts: [
        {
          type: "image",
          image: "/attachments/old.webp",
          filename: "old.webp",
          mediaType: "image/webp",
        },
      ],
    },
    {
      id: "first-assistant",
      role: "assistant",
      content: "old answer",
      parts: [{ type: "text", text: "old answer" }],
    },
    {
      id: "latest-user",
      role: "user",
      content: "",
      parts: [
        {
          type: "image",
          image: "/attachments/current.webp",
          filename: "current.webp",
          mediaType: "image/webp",
        },
      ],
    },
  ];

  assert.deepEqual(trimHistoricalAttachmentsForProvider(messages), [
    messages[1],
    messages[2],
  ]);
});

test("trimHistoricalAttachmentsForProvider keeps historical text when trimming attachments", () => {
  const messages: NormalizedChatMessage[] = [
    {
      id: "first-user",
      role: "user",
      content: "describe this",
      parts: [
        { type: "text", text: "describe this" },
        {
          type: "image",
          image: "/attachments/old.webp",
          filename: "old.webp",
          mediaType: "image/webp",
        },
      ],
    },
    {
      id: "latest-user",
      role: "user",
      content: "",
      parts: [
        {
          type: "image",
          image: "/attachments/current.webp",
          filename: "current.webp",
          mediaType: "image/webp",
        },
      ],
    },
  ];

  assert.deepEqual(trimHistoricalAttachmentsForProvider(messages), [
    {
      ...messages[0],
      parts: [{ type: "text", text: "describe this" }],
    },
    messages[1],
  ]);
});

test("chat invocation metadata keeps code-plan and agent-plan endpoints independent", () => {
  const messages: NormalizedChatMessage[] = [
    { id: "user", role: "user", content: "hello", parts: [] },
  ];
  const createResolution = (
    providerTemplateCode:
      | "volcengine-code-plan"
      | "volcengine-agent-plan",
  ): ProviderResolution => ({
    providerCode: "volcengine",
    providerConnectionId: providerTemplateCode,
    providerTemplateCode,
    baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
    apiKey: "secret",
    model: `${providerTemplateCode}-model`,
    modelConfigId: `${providerTemplateCode}-config`,
    params: {},
  });

  assert.equal(
    describeResolvedChatInvocation(
      createResolution("volcengine-code-plan"),
      messages,
      "chat",
    ).endpoint,
    "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
  );
  assert.equal(
    describeResolvedChatInvocation(
      createResolution("volcengine-agent-plan"),
      messages,
      "task-chat",
    ).endpoint,
    "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions",
  );
});
