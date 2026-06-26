// @vitest-environment jsdom
import assert from "node:assert/strict";
import { fireEvent, render, screen } from "@testing-library/react";
import { test } from "vitest";
import "@/shared/i18n";
import { UChatToolTrace } from "./UChatToolTrace";

test("UChatToolTrace renders a collapsed summary and expandable details", () => {
  render(
    <UChatToolTrace
      entries={[
        {
          toolCallId: "search-1",
          toolName: "web_search",
          status: "requested",
          input: {
            query: "今天是什么日期",
          },
        },
        {
          toolCallId: "search-1",
          toolName: "web_search",
          status: "succeeded",
          input: {
            query: "今天是什么日期",
          },
          output: {
            provider: "searxng",
            results: [{ title: "Today" }, { title: "Calendar" }],
          },
        },
      ]}
    />,
  );

  assert.ok(screen.getByText("Tool Calls"));
  assert.ok(screen.getByText("web_search"));
  assert.ok(screen.getByText("Succeeded"));
  assert.ok(screen.getByText("web_search completed · searxng · 2"));

  fireEvent.click(screen.getByRole("button", { name: "Show details" }));

  assert.equal(screen.getAllByText("Call ID: search-1").length, 2);
  assert.ok(screen.getAllByText("Input").length >= 1);
  assert.ok(screen.getByText("Output"));
  assert.equal(screen.getAllByText(/今天是什么日期/).length, 2);
});

test("UChatToolTrace surfaces failure details", () => {
  render(
    <UChatToolTrace
      entries={[
        {
          toolCallId: "search-2",
          toolName: "web_search",
          status: "failed",
          errorMessage: "SearXNG returned no usable results.",
        },
      ]}
    />,
  );

  assert.ok(screen.getByText("Failed"));
  assert.ok(screen.getByText("SearXNG returned no usable results."));

  fireEvent.click(screen.getByRole("button", { name: "Show details" }));

  assert.ok(screen.getByText("Error"));
});
