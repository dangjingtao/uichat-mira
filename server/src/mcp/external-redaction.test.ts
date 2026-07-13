import assert from "node:assert/strict";
import { test } from "vitest";
import { redactExternalMcpValue } from "./external-redaction.js";

test("redacts external MCP secrets recursively in objects, arrays, and text", () => {
  const value = redactExternalMcpValue(
    {
      safe: "visible",
      token: "token-value",
      nested: [
        { Authorization: "Bearer token-value" },
        { message: "remote secret=token-value" },
      ],
      artifact: { headers: { Authorization: "Bearer token-value" } },
    },
    ["token-value"],
  );

  assert.deepEqual(value, {
    safe: "visible",
    token: "[REDACTED]",
    nested: [
      { Authorization: "[REDACTED]" },
      { message: "remote secret=[REDACTED]" },
    ],
    artifact: { headers: "[REDACTED]" },
  });
});
