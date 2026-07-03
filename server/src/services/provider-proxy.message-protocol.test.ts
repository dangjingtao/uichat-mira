import assert from "node:assert/strict";
import { test } from "vitest";
import {
  getNormalizedMessageText,
  hasNormalizedMessageParts,
  hasNormalizedTextPart,
  normalizeProxyChatMessages,
} from "./provider-proxy.message-protocol.js";

test("normalizeProxyChatMessages preserves canonical text, image and file parts", () => {
  assert.deepEqual(
    normalizeProxyChatMessages([
      {
        id: "user-1",
        role: "user",
        parts: [
          { type: "text", text: "  explain this  " },
          {
            type: "image",
            image: " data:image/png;base64,abc ",
            filename: "chart.png",
            fileId: "file-1",
            mediaType: " image/png ",
          },
          {
            type: "file",
            data: " data:application/pdf;base64,abc ",
            filename: " doc.pdf ",
            mimeType: " application/pdf ",
          },
        ],
      },
    ]),
    [
      {
        id: "user-1",
        role: "user",
        content: "explain this",
        parts: [
          { type: "text", text: "  explain this  " },
          {
            type: "image",
            image: " data:image/png;base64,abc ",
            filename: "chart.png",
            fileId: "file-1",
            mediaType: "image/png",
          },
          {
            type: "file",
            data: " data:application/pdf;base64,abc ",
            filename: " doc.pdf ",
            mimeType: "application/pdf",
          },
        ],
      },
    ],
  );
});

test("normalizeProxyChatMessages drops empty parts and empty messages", () => {
  assert.deepEqual(
    normalizeProxyChatMessages([
      {
        id: "empty",
        role: "user",
        parts: [
          { type: "text", text: "   " },
          {
            type: "image",
            image: "   ",
          },
        ],
      },
      {
        id: "valid",
        role: "assistant",
        parts: [{ type: "text", text: " ok " }],
      },
    ]),
    [
      {
        id: "valid",
        role: "assistant",
        content: "ok",
        parts: [{ type: "text", text: " ok " }],
      },
    ],
  );
});

test("normalizeProxyChatMessages defaults missing image media type and file mime type", () => {
  assert.deepEqual(
    normalizeProxyChatMessages([
      {
        role: "user",
        parts: [
          {
            type: "image",
            image: "data:image/jpeg;base64,abc",
          },
          {
            type: "file",
            filename: "notes.txt",
            data: "data:text/plain;base64,abc",
            mimeType: "   ",
          },
        ],
      },
    ])[0]?.parts,
    [
      {
        type: "image",
        image: "data:image/jpeg;base64,abc",
        mediaType: "image/*",
      },
      {
        type: "file",
        filename: "notes.txt",
        data: "data:text/plain;base64,abc",
        mimeType: "application/octet-stream",
      },
    ],
  );
});

test("normalizeProxyChatMessages preserves leading and trailing whitespace in text payloads", () => {
  assert.deepEqual(
    normalizeProxyChatMessages([
      {
        role: "user",
        parts: [{ type: "text", text: "  keep me  " }],
      },
    ]),
    [
      {
        role: "user",
        content: "keep me",
        parts: [{ type: "text", text: "  keep me  " }],
      },
    ],
  );
});

test("normalizeProxyChatMessages keeps only supported canonical parts", () => {
  assert.deepEqual(
    normalizeProxyChatMessages([
      {
        role: "user",
        parts: [
          { type: "text", text: "   " },
          { type: "image", image: "   " },
          {
            type: "file",
            filename: "   ",
            data: "data:text/plain;base64,abc",
            mimeType: "text/plain",
          },
        ],
      },
      {
        role: "assistant",
        parts: [
          { type: "text", text: "hello" },
          {
            type: "image",
            image: "data:image/png;base64,abc",
            fileId: "asset-1",
            filename: "pic.png",
          },
          {
            type: "file",
            filename: "note.txt",
            data: "data:text/plain;base64,abc",
            fileId: "file-1",
            mimeType: " ",
          },
        ],
      },
    ]),
    [
      {
        role: "assistant",
        content: "hello",
        parts: [
          { type: "text", text: "hello" },
          {
            type: "image",
            image: "data:image/png;base64,abc",
            fileId: "asset-1",
            filename: "pic.png",
            mediaType: "image/*",
          },
          {
            type: "file",
            filename: "note.txt",
            data: "data:text/plain;base64,abc",
            fileId: "file-1",
            mimeType: "application/octet-stream",
          },
        ],
      },
    ],
  );
});

test("normalized message helpers cover empty and populated parts", () => {
  assert.equal(getNormalizedMessageText(undefined), "");
  assert.equal(hasNormalizedMessageParts(undefined), false);
  assert.equal(hasNormalizedTextPart(undefined), false);
  assert.equal(
    getNormalizedMessageText({
      parts: [{ type: "text", text: "  keep me  " }],
    }),
    "keep me",
  );
  assert.equal(
    hasNormalizedMessageParts({
      parts: [{ type: "text", text: "hello" }],
    }),
    true,
  );
  assert.equal(
    hasNormalizedTextPart({
      parts: [{ type: "text", text: "  hello  " }],
    }),
    true,
  );
  assert.equal(
    getNormalizedMessageText({
      parts: [
        { type: "text", text: " first " },
        { type: "image", image: "data:image/png;base64,abc" },
        { type: "text", text: " second " },
      ],
    }),
    "first \n second",
  );
});

test("normalizeProxyChatMessages returns empty array for unsupported or empty messages", () => {
  assert.deepEqual(
    normalizeProxyChatMessages([
      {
        role: "user",
        parts: [],
      },
      {
        role: "assistant",
        parts: [
          {
            type: "image",
            image: "   ",
          },
        ],
      },
    ]),
    [],
  );
});
