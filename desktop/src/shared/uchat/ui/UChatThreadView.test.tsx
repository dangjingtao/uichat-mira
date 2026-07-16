// @vitest-environment jsdom
import assert from "node:assert/strict";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { test, vi } from "vitest";
import "@/shared/i18n";
import i18n from "@/shared/i18n";
import { UChatThreadView } from "./UChatThreadView";
import type { ChatMessage } from "../core";
import { getChatMediaPreviewUrl } from "@/shared/api/thread";

vi.mock("@/app/providers/ThemeProvider", () => ({
  useThemePreferences: () => ({
    colorTheme: "warm-neutral",
    themeMode: "light",
    setColorTheme: () => {},
    setThemeMode: () => {},
    themePresets: [],
  }),
}));

vi.mock("@/shared/api/thread", () => ({
  getChatMediaPreviewUrl: vi.fn(async (_threadId: string, mediaId: string) =>
    `blob:http://localhost/${mediaId}`,
  ),
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

test("UChatThreadView renders generated image below assistant text and gates image action", async () => {
  const onRequestImage = vi.fn(() => Promise.resolve());
  const { rerender } = render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[baseAssistantMessage({
        metadata: { media: { image: { status: "succeeded", mediaId: "image-1" } } },
      })]}
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
      onRequestImage={onRequestImage}
      showImageAction
    />,
  );

  await waitFor(() => assert.ok(screen.getByRole("img", { name: /generated image|生成的图片/i })));
  const answer = screen.getByText("answer");
  const image = screen.getByRole("img", { name: /generated image|生成的图片/i });
  assert.ok(answer.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING);
  fireEvent.click(screen.getByRole("button", { name: /generate image|生成图片/i }));
  assert.equal(onRequestImage.mock.calls.length, 1);

  rerender(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[baseAssistantMessage({ metadata: { media: { image: { status: "failed" } } } })]}
      composer={{ text: "", attachments: [] }}
      runStatus={{ type: "idle" }}
      threadStatus="ready"
      capabilities={{ composerActions: [], messagePresentation: {} }}
      hasKnowledgeBase
      placeholder="Type"
      isSendDisabled={false}
      onComposerTextChange={() => {}}
      onComposerAttachmentsChange={() => {}}
      onSend={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
      onRequestImage={onRequestImage}
      showImageAction={false}
    />,
  );
  assert.equal(screen.queryByRole("button", { name: /generate image|生成图片|retry|重试/i }), null);
});

test("UChatThreadView requests TTS when a message has no completed audio", async () => {
  const onRequestTts = vi.fn(() => Promise.resolve());
  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[baseAssistantMessage()]}
      composer={{ text: "", attachments: [] }}
      runStatus={{ type: "idle" }}
      threadStatus="ready"
      capabilities={{ composerActions: [], messagePresentation: {} }}
      hasKnowledgeBase
      placeholder="Type"
      isSendDisabled={false}
      onComposerTextChange={() => {}}
      onComposerAttachmentsChange={() => {}}
      onSend={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
      onRequestTts={onRequestTts}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /play assistant audio|播放助手音频/i }));
  await waitFor(() => assert.equal(onRequestTts.mock.calls.length, 1));
});

test("UChatThreadView regenerates TTS when a succeeded media file is unavailable", async () => {
  const onRequestTts = vi.fn(() => Promise.resolve());
  const getPreviewUrl = vi.mocked(getChatMediaPreviewUrl);
  getPreviewUrl.mockRejectedValue(new Error("media not found"));

  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[baseAssistantMessage({
        metadata: { media: { tts: { status: "succeeded", mediaId: "audio-1" } } },
      })]}
      composer={{ text: "", attachments: [] }}
      runStatus={{ type: "idle" }}
      threadStatus="ready"
      capabilities={{ composerActions: [], messagePresentation: {} }}
      hasKnowledgeBase
      placeholder="Type"
      isSendDisabled={false}
      onComposerTextChange={() => {}}
      onComposerAttachmentsChange={() => {}}
      onSend={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
      onRequestTts={onRequestTts}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: /play assistant audio|播放助手音频/i }));
  await waitFor(() => assert.equal(onRequestTts.mock.calls.length, 1));
  getPreviewUrl.mockImplementation(async (_threadId, mediaId) => `blob:http://localhost/${mediaId}`);
});

test("UChatThreadView shows loading skeleton instead of welcome hero while hydrating a persisted thread", () => {
  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[]}
      composer={{ text: "", attachments: [] }}
      runStatus={{ type: "idle" }}
      threadStatus="loading"
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

  assert.ok(screen.getByTestId("uchat-thread-loading-skeleton"));
  assert.equal(screen.queryByText(i18n.t("chat.thread.empty.heading")), null);
});

test("UChatThreadView still shows welcome hero for the draft welcome state", () => {
  const { container } = render(
    <UChatThreadView
      activeThreadId={null}
      title="Thread"
      badges={[]}
      messages={[]}
      composer={{ text: "", attachments: [] }}
      runStatus={{ type: "idle" }}
      threadStatus="idle"
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

  const heroImage = container.querySelector('img[src*="welcome-astronaut-hero.png"]');
  assert.ok(heroImage);
  assert.equal(screen.queryByTestId("uchat-thread-loading-skeleton"), null);
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
  const onToggleAgentEnabled = vi.fn();

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
      agentEnabled
      onAgentSend={onAgentSend}
      onToggleAgentEnabled={onToggleAgentEnabled}
      agentToggleAvailability={{ enabled: true }}
      agentAvailability={{ enabled: true }}
      onApproveAgentRun={() => {}}
      onRejectAgentRun={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Run in Agent mode" }));
  assert.equal(onAgentSend.mock.calls.length, 1);
  assert.equal(onToggleAgentEnabled.mock.calls.length, 0);
});

test("UChatThreadView disables send arrow when Agent is enabled but workspace is unavailable", () => {
  const onAgentSend = vi.fn();
  const onSend = vi.fn();
  const onToggleAgentEnabled = vi.fn();

  render(
    <UChatThreadView
      activeThreadId={null}
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
      onSend={onSend}
      agentEnabled
      onAgentSend={onAgentSend}
      onToggleAgentEnabled={onToggleAgentEnabled}
      agentToggleAvailability={{
        enabled: false,
        disabledReason: "Bind a workspace before using Agent.",
      }}
      onApproveAgentRun={() => {}}
      onRejectAgentRun={() => {}}
      agentAvailability={{
        enabled: false,
        disabledReason: "Bind a workspace before using Agent.",
      }}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  const button = screen.getByRole("button", {
    name: "Run in Agent mode",
  });
  assert.equal(button.hasAttribute("disabled"), true);
  fireEvent.click(button);
  assert.equal(onAgentSend.mock.calls.length, 0);
  assert.equal(onSend.mock.calls.length, 0);
  assert.equal(onToggleAgentEnabled.mock.calls.length, 0);
});

test("UChatThreadView keeps normal send enabled when Agent toggle is off", () => {
  const onAgentSend = vi.fn();
  const onSend = vi.fn();
  const onToggleAgentEnabled = vi.fn();

  render(
    <UChatThreadView
      activeThreadId={null}
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
      onSend={onSend}
      agentEnabled={false}
      onAgentSend={onAgentSend}
      onToggleAgentEnabled={onToggleAgentEnabled}
      agentToggleAvailability={{
        enabled: false,
        disabledReason: "Bind a workspace before using Agent.",
      }}
      onApproveAgentRun={() => {}}
      onRejectAgentRun={() => {}}
      agentAvailability={{
        enabled: false,
        disabledReason: "Bind a workspace before using Agent.",
      }}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  const button = screen.getByRole("button", {
    name: "chat.thread.actions.send",
  });
  assert.equal(button.hasAttribute("disabled"), false);
  fireEvent.click(button);
  assert.equal(onSend.mock.calls.length, 1);
  assert.equal(onAgentSend.mock.calls.length, 0);
  assert.equal(onToggleAgentEnabled.mock.calls.length, 0);
});

test("UChatThreadView calls the real Agent toggle handler", () => {
  const onToggleAgentEnabled = vi.fn();

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
      agentEnabled={false}
      onToggleAgentEnabled={onToggleAgentEnabled}
      agentToggleAvailability={{
        enabled: true,
      }}
      agentAvailability={{
        enabled: true,
      }}
      onApproveAgentRun={() => {}}
      onRejectAgentRun={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Enable Agent" }));
  assert.equal(onToggleAgentEnabled.mock.calls.length, 1);
});

test("UChatThreadView disables enabling Agent when workspace is unavailable", () => {
  const onToggleAgentEnabled = vi.fn();

  render(
    <UChatThreadView
      activeThreadId={null}
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
      agentEnabled={false}
      onToggleAgentEnabled={onToggleAgentEnabled}
      agentToggleAvailability={{
        enabled: false,
        disabledReason: "Bind a workspace before using Agent.",
      }}
      agentAvailability={{
        enabled: false,
        disabledReason: "Bind a workspace before using Agent.",
      }}
      onApproveAgentRun={() => {}}
      onRejectAgentRun={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  const button = screen.getByRole("button", { name: "Enable Agent" });
  assert.equal(button.hasAttribute("disabled"), true);
  fireEvent.click(button);
  assert.equal(onToggleAgentEnabled.mock.calls.length, 0);
});

test("UChatThreadView exposes workspace submenu actions from composer menu", async () => {
  const user = userEvent.setup();

  render(
    <UChatThreadView
      activeThreadId={null}
      title="Thread"
      badges={[]}
      messages={[]}
      composer={{ text: "hello", attachments: [] }}
      runStatus={{ type: "idle" }}
      threadStatus="ready"
      capabilities={{
        composerActions: [
          {
            id: "workspace-actions",
            kind: "menu",
            label: "Workspace",
            title: "Workspace actions",
            children: [
              {
                id: "workspace-add-thread",
                kind: "command",
                label: "Add to workspace",
                title: "Add thread to workspace",
              },
              {
                id: "workspace-create",
                kind: "command",
                label: "Create workspace",
                title: "Create workspace",
              },
            ],
          },
        ],
        messagePresentation: {},
      }}
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

  await user.click(screen.getByRole("button", { name: "Composer menu" }));
  await user.hover(screen.getByRole("menuitem", { name: "Workspace" }));

  assert.ok(await screen.findByRole("menuitem", { name: "Add to workspace" }));
  assert.ok(screen.getByRole("menuitem", { name: "Create workspace" }));
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
      onApproveAgentRun={() => {}}
      onRejectAgentRun={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  assert.ok(screen.getByText(i18n.t("chat.thread.agent.blockedTitle")));
  assert.ok(screen.getByText("Agent run did not produce an answer."));
});

test("UChatThreadView renders failed agent status when failure card is not present", () => {
  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[
        baseAssistantMessage({
          metadata: {
            agent: {
              status: "failed",
              errorMessage: "Agent tool execution failed.",
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
      onApproveAgentRun={() => {}}
      onRejectAgentRun={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  assert.ok(screen.getByText(i18n.t("chat.thread.agent.failedTitle")));
  assert.ok(screen.getByText("Agent tool execution failed."));
});

test("UChatThreadView shows agent running copy for streaming agent reply", () => {
  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[
        baseAssistantMessage({
          status: "streaming",
          parts: [],
          metadata: {
            agent: {
              status: "completed",
            },
          },
        }),
      ]}
      composer={{ text: "", attachments: [] }}
      runStatus={{ type: "running" }}
      threadStatus="ready"
      capabilities={{ composerActions: [], messagePresentation: {} }}
      hasKnowledgeBase={false}
      placeholder="Type"
      isSendDisabled={false}
      onComposerTextChange={() => {}}
      onComposerAttachmentsChange={() => {}}
      onSend={() => {}}
      onApproveAgentRun={() => {}}
      onRejectAgentRun={() => {}}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
      isAgentRunning
    />,
  );

  assert.ok(screen.getByText(i18n.t("chat.thread.agent.running")));
});

test("UChatThreadView shows approve and reject actions for waiting approval agent messages", () => {
  const onApproveAgentRun = vi.fn();

  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[
        baseAssistantMessage({
          metadata: {
            agent: {
              status: "waiting_approval",
              runId: "run-1",
              pendingApproval: {
                toolId: "terminal_session",
                reason: "需要人工审批后继续。",
              },
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
      onApproveAgentRun={onApproveAgentRun}
      onRejectAgentRun={() => Promise.resolve()}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  assert.ok(screen.getByRole("button", { name: "Approve" }));
  assert.ok(screen.getByRole("button", { name: "Reject" }));
});

test("UChatThreadView calls approve action for waiting approval agent messages", async () => {
  const onApproveAgentRun = vi.fn(() => Promise.resolve());

  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[
        baseAssistantMessage({
          metadata: {
            agent: {
              status: "waiting_approval",
              runId: "run-1",
              pendingApproval: {
                toolId: "terminal_session",
                reason: "需要人工审批后继续。",
              },
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
      onApproveAgentRun={onApproveAgentRun}
      onRejectAgentRun={() => Promise.resolve()}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await Promise.resolve();
  });

  assert.equal(onApproveAgentRun.mock.calls.length, 1);
  assert.deepEqual(onApproveAgentRun.mock.calls[0], ["run-1"]);
});

test("UChatThreadView calls reject action for waiting approval agent messages", async () => {
  const onRejectAgentRun = vi.fn(() => Promise.resolve());

  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[
        baseAssistantMessage({
          metadata: {
            agent: {
              status: "waiting_approval",
              runId: "run-1",
              pendingApproval: {
                toolId: "terminal_session",
                reason: "需要人工审批后继续。",
              },
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
      onApproveAgentRun={() => Promise.resolve()}
      onRejectAgentRun={onRejectAgentRun}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    await Promise.resolve();
  });

  assert.equal(onRejectAgentRun.mock.calls.length, 1);
  assert.deepEqual(onRejectAgentRun.mock.calls[0], ["run-1"]);
});

test("UChatThreadView shows inline error and re-enables buttons when approval fails", async () => {
  const onApproveAgentRun = vi.fn(
    () => Promise.reject(new Error("审批服务暂时不可用")),
  );

  render(
    <UChatThreadView
      activeThreadId="thread-1"
      title="Thread"
      badges={[]}
      messages={[
        baseAssistantMessage({
          metadata: {
            agent: {
              status: "waiting_approval",
              runId: "run-1",
              pendingApproval: {
                toolId: "terminal_session",
                reason: "需要人工审批后继续。",
              },
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
      onApproveAgentRun={onApproveAgentRun}
      onRejectAgentRun={() => Promise.resolve()}
      onComposerAction={() => {}}
      threadContextTags={[]}
      resolveAttachmentSource={(value) => value}
    />,
  );

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  });

  await waitFor(() => {
    assert.ok(screen.getByText("审批服务暂时不可用"));
  });
  assert.equal(screen.getByRole("button", { name: "Approve" }).hasAttribute("disabled"), false);
  assert.equal(screen.getByRole("button", { name: "Reject" }).hasAttribute("disabled"), false);
});
