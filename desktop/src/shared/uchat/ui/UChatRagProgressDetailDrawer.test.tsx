// @vitest-environment jsdom
import assert from "node:assert/strict";
import { render, screen } from "@testing-library/react";
import { test } from "vitest";
import "@/shared/i18n";
import { UChatRagProgressDetailDrawer } from "./UChatRagProgressDetailDrawer";

test("UChatRagProgressDetailDrawer renders tool execution detail payload", () => {
  render(
    <UChatRagProgressDetailDrawer
      open
      onClose={() => {}}
      detail={{
        messageId: "assistant-1",
        nodeId: "tool-1",
        nodeType: "tool",
        label: "web_search",
        status: "done",
        summary: "web_search completed",
        details: {
          toolName: "web_search",
          callId: "call-1",
          input: {
            query: "today date",
          },
          output: {
            provider: "searxng",
          },
        },
      }}
    />,
  );

  assert.ok(screen.getByText("web_search"));
  assert.ok(screen.getByText(/"nodeType": "tool"/));
  assert.ok(screen.getByText(/"toolName": "web_search"/));
  assert.ok(screen.getByText(/"query": "today date"/));
  assert.ok(screen.getByText(/"provider": "searxng"/));
});
