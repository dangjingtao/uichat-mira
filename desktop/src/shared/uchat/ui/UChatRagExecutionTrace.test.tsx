// @vitest-environment jsdom
import assert from "node:assert/strict";
import { fireEvent, render, screen } from "@testing-library/react";
import { test } from "vitest";
import "@/shared/i18n";
import { UChatRagExecutionTrace } from "./UChatRagExecutionTrace";

test("UChatRagExecutionTrace renders tool nodes in the shared execution timeline", () => {
  render(
    <UChatRagExecutionTrace
      messageId="assistant-1"
      onOpenDetail={() => {}}
      steps={[
        {
          nodeId: "tool-1",
          nodeType: "tool",
          phase: "start",
          label: "web_search",
          details: {
            toolName: "web_search",
            input: {
              query: "today date",
            },
          },
        },
      ]}
    />,
  );

  assert.ok(screen.getAllByText("Running web_search").length >= 1);

  fireEvent.click(screen.getByRole("button"));

  assert.ok(screen.getByText("web_search"));
  assert.ok(screen.getAllByText("Running web_search").length >= 2);
});
