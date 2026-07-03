import assert from "node:assert/strict";
import { test } from "vitest";
import type { Message as ThreadApiMessage } from "@/shared/api/thread";
import { __protocolTestUtils } from "./protocol";

test("protocol ignores finish events when finishReason is error", () => {
  const runEvent = __protocolTestUtils.toRunEvent({
    type: "finish",
    finishReason: "error",
  });

  assert.equal(runEvent, null);
});

test("protocol still completes assistant messages on successful finish", () => {
  const runEvent = __protocolTestUtils.toRunEvent({
    type: "finish",
    finishReason: "stop",
  });

  assert.deepEqual(runEvent, { type: "message:finish" });
});

test("protocol maps tool lifecycle events into chat run events", () => {
  const runEvent = __protocolTestUtils.toRunEvent({
    type: "data-tool-event",
    data: {
      callId: "call-1",
      toolName: "web_search",
      status: "running",
      input: {
        query: "hello",
      },
    },
  });

  assert.deepEqual(runEvent, {
    type: "message:tool",
    toolCallId: "call-1",
    toolName: "web_search",
    status: "running",
    input: {
      query: "hello",
    },
  });
});

test("protocol maps execution node events into data parts", () => {
  const runEvent = __protocolTestUtils.toRunEvent({
    type: "data-execution-node",
    data: {
      nodeId: "tool-1",
      nodeType: "tool",
      phase: "start",
      label: "web_search",
      summary: "Running web_search",
    },
  });

  assert.deepEqual(runEvent, {
    type: "message:part",
    part: {
      type: "data",
      name: "execution-node",
      value: {
        nodeId: "tool-1",
        nodeType: "tool",
        phase: "start",
        label: "web_search",
        summary: "Running web_search",
      },
    },
  });
});

test("protocol upgrades legacy rag node events into execution-node parts", () => {
  const runEvent = __protocolTestUtils.toRunEvent({
    type: "data-rag-node",
    data: {
      nodeId: "retrieve-1",
      nodeType: "retrieve",
      phase: "done",
      label: "Retrieve",
      summary: "Retrieved 5 chunks",
    },
  });

  assert.deepEqual(runEvent, {
    type: "message:part",
    part: {
      type: "data",
      name: "execution-node",
      value: {
        nodeId: "retrieve-1",
        nodeType: "retrieve",
        phase: "done",
        label: "Retrieve",
        summary: "Retrieved 5 chunks",
      },
    },
  });
});

test("protocol upgrades legacy metadata.tools into message.toolTrace", async () => {
  const message: ThreadApiMessage = {
    id: "assistant-1",
    threadId: "thread-1",
    role: "assistant",
    content: "done",
    parts: [{ type: "text", text: "done" }],
    metadata: {
      tools: [
        {
          toolCallId: "call-1",
          toolName: "web_search",
          status: "succeeded",
          input: { query: "today" },
          output: { results: 3 },
        },
      ],
    },
    createdAt: "2025-01-01T00:00:00.000Z",
  };

  const normalized = __protocolTestUtils.normalizeMessage(
    "thread-1",
    message,
    null,
  );

  assert.deepEqual(normalized.toolTrace, [
    {
      toolCallId: "call-1",
      toolName: "web_search",
      status: "succeeded",
      input: { query: "today" },
      output: { results: 3 },
    },
  ]);
});
