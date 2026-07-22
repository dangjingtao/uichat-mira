import assert from "node:assert/strict";
import { test } from "vitest";
import type { ChatMessage } from "../core";
import { getUChatMessageTraceState } from "./UChatMessageTrace";

const createMessage = (
  overrides: Partial<ChatMessage> = {},
): ChatMessage => ({
  id: "assistant-1",
  threadId: "thread-1",
  role: "assistant",
  parts: [],
  createdAt: "2026-07-22T00:00:00.000Z",
  status: "complete",
  ...overrides,
});

test("getUChatMessageTraceState keeps Agent nodes in the shared execution trace", () => {
  const state = getUChatMessageTraceState(
    createMessage({
      parts: [
        {
          type: "data",
          name: "execution-node",
          value: {
            nodeId: "agent-plan",
            traceDomain: "agent",
            nodeType: "plan",
            phase: "done",
            label: "执行计划",
          },
        },
      ],
    }),
  );

  assert.equal(state.hasTrace, true);
  assert.equal(state.steps.length, 1);
  assert.equal(state.steps[0]?.traceDomain, "agent");
  assert.equal(state.steps[0]?.nodeType, "plan");
});

test("getUChatMessageTraceState keeps legacy RAG nodes in the same trace", () => {
  const state = getUChatMessageTraceState(
    createMessage({
      parts: [
        {
          type: "data",
          name: "rag-node",
          value: {
            nodeId: "retrieve",
            traceDomain: "rag",
            nodeType: "retrieve",
            phase: "done",
            label: "知识检索",
          },
        },
      ],
    }),
  );

  assert.equal(state.hasTrace, true);
  assert.equal(state.steps[0]?.traceDomain, "rag");
  assert.equal(state.steps[0]?.nodeType, "retrieve");
});

test("getUChatMessageTraceState derives Agent failures from traceDomain", () => {
  const state = getUChatMessageTraceState(
    createMessage({
      status: "error",
      errorMessage: "tool failed",
      parts: [
        {
          type: "data",
          name: "execution-node",
          value: {
            nodeId: "agent-tool",
            traceDomain: "agent",
            nodeType: "tool",
            phase: "error",
            label: "read_file",
          },
        },
      ],
    }),
  );

  assert.equal(state.failurePresentation?.rawErrorMessage, "tool failed");
  assert.ok(state.failurePresentation?.title);
});
