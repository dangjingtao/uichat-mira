import assert from "node:assert/strict";
import { test } from "vitest";
import { extractPlannerVisibleThought } from "../planner/node";

test("extractPlannerVisibleThought reads a reason from partial streamed JSON", () => {
  assert.equal(
    extractPlannerVisibleThought(
      '{"type":"use_tool","toolId":"read_open","args":{"path":"index.html"},"reason":"我先确认页面内容，再判断',
    ),
    "我先确认页面内容，再判断",
  );
});

test("extractPlannerVisibleThought decodes escaped JSON string content", () => {
  assert.equal(
    extractPlannerVisibleThought(
      '{"reason":"我会先读取 \\"index.html\\"，再继续分析。","type":"use_tool"}',
    ),
    '我会先读取 "index.html"，再继续分析。',
  );
});

test("extractPlannerVisibleThought does not expose unrelated raw planner fields", () => {
  assert.equal(
    extractPlannerVisibleThought(
      '{"type":"use_tool","toolId":"read_open","args":{"path":"index.html"}',
    ),
    null,
  );
});