import assert from "node:assert/strict";
import { test } from "vitest";
import { trimHistoricalAttachmentsForProvider } from "./chat-adapters.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";

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
