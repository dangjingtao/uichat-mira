// @vitest-environment jsdom
import assert from "node:assert/strict";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, test, vi } from "vitest";
import i18n from "@/shared/i18n";
import type { ChatMessage } from "../core";
import { UChatAgentMessageStatus } from "./UChatAgentMessageStatus";

const agentMessage = (
  agent: NonNullable<ChatMessage["metadata"]>["agent"],
): ChatMessage => ({
  id: "assistant-1",
  threadId: "thread-1",
  role: "assistant",
  parts: [{ type: "text", text: "answer" }],
  createdAt: "2025-01-01T00:00:00.000Z",
  parentId: "user-1",
  status: "complete",
  metadata: { agent },
});

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
});

test("UChatAgentMessageStatus approves a waiting Agent run", async () => {
  const onApprove = vi.fn(() => Promise.resolve());
  render(
    <UChatAgentMessageStatus
      message={agentMessage({
        status: "waiting_approval",
        runId: "run-1",
        pendingApproval: { reason: "Allow file write" },
      })}
      hideFailedStatus={false}
      controller={{
        enabled: true,
        onApprove,
        onReject: () => {},
      }}
    />,
  );

  assert.ok(screen.getByText("Allow file write"));
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => {
    assert.deepEqual(onApprove.mock.calls[0], ["run-1"]);
  });
});

test("UChatAgentMessageStatus keeps approval errors inside the Agent component", async () => {
  const onReject = vi.fn(() => Promise.reject(new Error("Reject failed")));
  render(
    <UChatAgentMessageStatus
      message={agentMessage({
        status: "waiting_approval",
        runId: "run-1",
      })}
      hideFailedStatus={false}
      controller={{
        enabled: true,
        onApprove: () => {},
        onReject,
      }}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Reject" }));
  assert.ok(await screen.findByText("Reject failed"));
});

test("UChatAgentMessageStatus avoids duplicating a failed execution trace", () => {
  render(
    <UChatAgentMessageStatus
      message={agentMessage({
        status: "failed",
        errorMessage: "Agent failed",
      })}
      hideFailedStatus
    />,
  );

  assert.equal(screen.queryByText("Agent failed"), null);
});
