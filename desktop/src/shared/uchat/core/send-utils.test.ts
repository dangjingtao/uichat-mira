import assert from "node:assert/strict";
import { test } from "vitest";
import { buildOutgoingUserParts } from "./send-utils";

test("buildOutgoingUserParts returns empty parts for blank draft", () => {
  assert.deepEqual(
    buildOutgoingUserParts({
      text: "   ",
      attachments: [],
    }),
    [],
  );
});

test("buildOutgoingUserParts preserves text and uploaded attachments", () => {
  assert.deepEqual(
    buildOutgoingUserParts({
      text: " hello ",
      attachments: [
        {
          uploadedPart: {
            type: "image",
            source: "/attachments/image.webp",
            name: "image.webp",
            mimeType: "image/webp",
            assetId: "asset-1",
          },
        },
      ],
    }),
    [
      { type: "text", text: "hello" },
      {
        type: "image",
        source: "/attachments/image.webp",
        name: "image.webp",
        mimeType: "image/webp",
        assetId: "asset-1",
      },
    ],
  );
});
