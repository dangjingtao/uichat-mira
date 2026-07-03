import assert from "node:assert/strict";
import { test } from "vitest";
import { normalizeMessageParts } from "../core/protocol";
import type { Message as ThreadApiMessage } from "@/shared/api/thread";

test("desktop protocol normalizes canonical thread parts into uchat parts", () => {
  const message: ThreadApiMessage = {
    id: "message-1",
    threadId: "thread-1",
    role: "assistant",
    content: "",
    parts: [
      { type: "text", text: "hello" },
      {
        type: "image",
        image: "/attachments/image-1.webp",
        filename: "image-1.webp",
        fileId: "file-1",
        mediaType: "image/webp",
      },
      {
        type: "file",
        data: "/attachments/file-1.pdf",
        filename: "file-1.pdf",
        fileId: "file-2",
        mimeType: "application/pdf",
      },
    ],
    metadata: {
      rag: {
        sources: [],
      },
    },
    createdAt: "2025-01-01T00:00:01.000Z",
  };

  assert.deepEqual(normalizeMessageParts(message), [
    { type: "text", text: "hello" },
    {
      type: "image",
      source: "/attachments/image-1.webp",
      name: "image-1.webp",
      assetId: "file-1",
      mimeType: "image/webp",
    },
    {
      type: "file",
      source: "/attachments/file-1.pdf",
      name: "file-1.pdf",
      assetId: "file-2",
      mimeType: "application/pdf",
    },
  ]);
});

