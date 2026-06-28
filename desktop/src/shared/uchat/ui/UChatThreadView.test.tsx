// @vitest-environment jsdom
import assert from "node:assert/strict";
import { fireEvent, render, screen } from "@testing-library/react";
import { test, vi } from "vitest";
import "@/shared/i18n";
import { UChatThreadView } from "./UChatThreadView";
import type { ChatMessage } from "../core";

vi.mock("@/app/providers/ThemeProvider", () => ({
  useThemePreferences: () => ({
    colorTheme: "warm-neutral",
    themeMode: "light",
    setColorTheme: () => {},
    setThemeMode: () => {},
    themePresets: [],
  }),
}));

const baseAssistantMessage = (
  overrides: Partial<ChatMessage> = {},
): ChatMessage => ({
  id: overrides.id ?? "assistant-1",
  threadId: overrides.threadId ?? "thread-1",
  role: "assistant",
  parts: overrides.parts ?? [{ type: "text", text: "answer" }],
  createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
  parentId: overrides.parentId ?? "user-1",
  status: overrides.status ?? "complete",
  metadata: overrides.metadata,
  toolTrace: overrides.toolTrace,
  errorMessage: overrides.errorMessage,
});

test("UChatThreadView hides legacy tool trace card when execution trace parts exist", () => {
  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[
        baseAssistantMessage({
          parts: [
            {
              type: "data",
              name: "execution-node",
              value: {
                nodeId: "tool-1",
                nodeType: "tool",
                phase: "done",
                label: "web_search",
                summary: "web_search completed",
                details: {
                  toolName: "web_search",
                },
              },
            },
            { type: "text", text: "answer" },
          ],
          toolTrace: [
            {
              toolCallId: "tool-1",
              toolName: "web_search",
              status: "succeeded",
              output: { provider: "tavily", results: [{ title: "Today" }] },
            },
          ],
        }),
      ]}
      composer={{ text: "", attachments: [] }}
      runStatus={{ type: "idle" }}
      threadStatus="ready"
      capabilities={{ composerActions: [], messagePresentation: {} }}
      hasKnowledgeBase={false}
      placeholder="Type"
      isSendDisabled={false}
      onComposerTextChange={() => {}}
      onComposerAttachmentsChange={() => {}}
      onSend={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  assert.ok(screen.getByText("web_search"));
  assert.equal(screen.queryByText("Tool Calls"), null);
});

test("UChatThreadView still shows legacy tool trace card when no execution trace exists", () => {
  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[
        baseAssistantMessage({
          toolTrace: [
            {
              toolCallId: "tool-1",
              toolName: "web_search",
              status: "succeeded",
              output: { provider: "tavily", results: [{ title: "Today" }] },
            },
          ],
        }),
      ]}
      composer={{ text: "", attachments: [] }}
      runStatus={{ type: "idle" }}
      threadStatus="ready"
      capabilities={{ composerActions: [], messagePresentation: {} }}
      hasKnowledgeBase={false}
      placeholder="Type"
      isSendDisabled={false}
      onComposerTextChange={() => {}}
      onComposerAttachmentsChange={() => {}}
      onSend={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  assert.ok(screen.getByText("Tool Calls"));
});

test("UChatThreadView calls onAgentSend when the Agent button is clicked", () => {
  const onAgentSend = vi.fn();

  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[]}
      composer={{ text: "hello", attachments: [] }}
      runStatus={{ type: "idle" }}
      threadStatus="ready"
      capabilities={{ composerActions: [], messagePresentation: {} }}
      hasKnowledgeBase={false}
      placeholder="Type"
      isSendDisabled={false}
      onComposerTextChange={() => {}}
      onComposerAttachmentsChange={() => {}}
      onSend={() => {}}
      onAgentSend={onAgentSend}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Agent run" }));
  assert.equal(onAgentSend.mock.calls.length, 1);
});

test("UChatThreadView renders blocked agent status", () => {
  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[
        baseAssistantMessage({
          metadata: {
            agent: {
              status: "blocked",
              errorMessage: "Agent run did not produce an answer.",
            },
          },
        }),
      ]}
      composer={{ text: "", attachments: [] }}
      runStatus={{ type: "idle" }}
      threadStatus="ready"
      capabilities={{ composerActions: [], messagePresentation: {} }}
      hasKnowledgeBase={false}
      placeholder="Type"
      isSendDisabled={false}
      onComposerTextChange={() => {}}
      onComposerAttachmentsChange={() => {}}
      onSend={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  assert.ok(screen.getByText("Agent 已阻断"));
  assert.ok(screen.getByText("Agent run did not produce an answer."));
});
