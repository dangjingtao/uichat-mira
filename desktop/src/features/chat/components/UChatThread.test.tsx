// @vitest-environment jsdom
import assert from "node:assert/strict";
import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, test, vi, beforeEach } from "vitest";
import "@/shared/i18n";
import i18n from "@/shared/i18n";
import UChatThread from "./UChatThread";

const sendMock = vi.fn();
const updateThreadRuntimeMock = vi.fn();
const refreshThreadMock = vi.fn();
const setDraftWorkspaceIdMock = vi.fn();
const setDraftAgentEnabledMock = vi.fn();
const messageErrorMock = vi.hoisted(() => vi.fn());
const draftWorkspaceState = vi.hoisted(() => ({
  value: "workspace-1" as string | null,
}));
const draftAgentEnabledState = vi.hoisted(() => ({
  value: true as boolean,
}));
const runtimeSelectorState = vi.hoisted(() => ({
  activeThreadId: null as string | null,
  threads: [] as any[],
  runStatus: { type: "idle" } as { type: "idle" | "running" },
}));

vi.mock("@/app/providers/ThemeProvider", () => ({
  useThemePreferences: () => ({
    colorTheme: "warm-neutral",
    themeMode: "light",
    setColorTheme: () => {},
    setThemeMode: () => {},
    themePresets: [],
  }),
}));

vi.mock("@/app/providers/RoleModelConfigProvider", () => ({
  useRoleModelConfigs: () => ({
    configMap: {
      llm: { name: "gpt-test" },
      task: null,
      embedding: null,
      rerank: null,
    },
    hasDefaultEmbedding: true,
    hasDefaultLlm: true,
  }),
}));

vi.mock("@/features/chat/core/knowledgeBaseState", () => ({
  useChatKnowledgeBaseState: () => ({
    knowledgeBases: [],
  }),
}));

vi.mock("@/features/chat/core/runtime", () => ({
  useChatRuntime: () => ({
    send: sendMock,
    cancelSend: vi.fn(),
    regenerate: vi.fn(),
    editUserMessage: vi.fn(),
    setComposerText: vi.fn(),
    setComposerAttachments: vi.fn(),
    appendComposerAttachments: vi.fn(),
    removeComposerAttachment: vi.fn(),
    updateThread: updateThreadRuntimeMock,
    refreshThread: refreshThreadMock,
  }),
  useChatRuntimeSelector: (selector: (state: any) => unknown) =>
    selector({
      activeThreadId: runtimeSelectorState.activeThreadId,
      threads: runtimeSelectorState.threads,
      composer: { text: "hello", attachments: [] },
      runStatus: runtimeSelectorState.runStatus,
      threadStatus: "ready",
      capabilities: { composerActions: [], messagePresentation: {} },
    }),
  useChatThreadDraftState: () => ({
    draftKnowledgeBaseId: null,
    draftRoleId: null,
    draftAgentEnabled: draftAgentEnabledState.value,
    draftWorkspaceId: draftWorkspaceState.value,
    setDraftKnowledgeBaseId: vi.fn(),
    setDraftRoleId: vi.fn(),
    setDraftAgentEnabled: setDraftAgentEnabledMock,
    setDraftWorkspaceId: setDraftWorkspaceIdMock,
  }),
}));

vi.mock("@/features/chat/core/composerPolicy", () => ({
  useUChatComposerState: () => ({
    isSendDisabled: false,
    placeholder: "Type a question and press Enter...",
  }),
}));

vi.mock("@/features/chat/core/protocol", () => ({
  resolveAttachmentSource: (value: string) => value,
}));

vi.mock("@/shared/api/roles", () => ({
  listRoles: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/shared/api/thread", () => ({
  listChatWorkspaces: vi.fn().mockResolvedValue([]),
  createChatWorkspace: vi.fn(),
  updateThread: vi.fn(),
  approveAgentRun: vi.fn(),
  rejectAgentRun: vi.fn(),
}));

vi.mock("@/shared/avatars", () => ({
  getBuiltinAvatarPack16Options: () => [],
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getDesktopRuntime: () => ({
    platform: "win32",
  }),
  getApiBaseUrl: () => "http://127.0.0.1:3000",
  getChatApiUrl: () => "http://127.0.0.1:3000/proxy/chat/default",
}));

vi.mock("@/shared/ui", async () => {
  const actual = await vi.importActual("@/shared/ui");
  return {
    ...actual,
    message: {
      error: messageErrorMock,
    },
  };
});

vi.mock("./ThreadContextSummaryModalContent", () => ({
  default: () => null,
}));

vi.mock("@/shared/ui/SearchSelectModal", () => ({
  default: () => null,
}));

describe("UChatThread", () => {
  beforeEach(() => {
    sendMock.mockReset();
    updateThreadRuntimeMock.mockReset();
    refreshThreadMock.mockReset();
    setDraftWorkspaceIdMock.mockReset();
    setDraftAgentEnabledMock.mockReset();
    messageErrorMock.mockReset();
    draftWorkspaceState.value = "workspace-1";
    draftAgentEnabledState.value = true;
    runtimeSelectorState.activeThreadId = null;
    runtimeSelectorState.threads = [];
    runtimeSelectorState.runStatus = { type: "idle" };
  });

  test("welcome state can run agent after workspace is bound", async () => {
    await act(async () => {
      render(<UChatThread />);
    });

    fireEvent.click(screen.getByRole("button", { name: "Run in Agent mode" }));

    await waitFor(() => {
      assert.equal(sendMock.mock.calls.length, 1);
    });
    assert.deepEqual(sendMock.mock.calls[0]?.[0], { agentEnabled: true });
  });

  test("agent button is disabled in welcome state when workspace is missing", async () => {
    draftWorkspaceState.value = null;
    draftAgentEnabledState.value = false;

    await act(async () => {
      render(<UChatThread />);
    });

    const button = screen.getByRole("button", { name: "Enable Agent" });
    assert.equal(button.hasAttribute("disabled"), true);

    fireEvent.click(button);
    assert.equal(sendMock.mock.calls.length, 0);
    assert.equal(setDraftAgentEnabledMock.mock.calls.length, 0);
    assert.equal(messageErrorMock.mock.calls.length, 0);
  });

  test("agent toggle stays enabled once workspace is bound even if agent mode is still off", async () => {
    draftWorkspaceState.value = "workspace-1";
    draftAgentEnabledState.value = false;

    await act(async () => {
      render(<UChatThread />);
    });

    const button = screen.getByRole("button", { name: "Enable Agent" });
    assert.equal(button.hasAttribute("disabled"), false);
  });

  test("welcome state falls back to normal send when agent toggle is off", async () => {
    draftAgentEnabledState.value = false;

    await act(async () => {
      render(<UChatThread />);
    });

    const button = screen.getByRole("button", { name: "chat.thread.actions.send" });
    assert.equal(button.hasAttribute("disabled"), false);
    fireEvent.click(button);

    await waitFor(() => {
      assert.equal(sendMock.mock.calls.length, 1);
    });
    assert.equal(sendMock.mock.calls[0]?.length ?? 0, 0);
  });

  test("thread agent enabled plus running status passes agent running state to view", async () => {
    runtimeSelectorState.activeThreadId = "thread-1";
    runtimeSelectorState.runStatus = { type: "running" };
    runtimeSelectorState.threads = [
      {
        id: "thread-1",
        title: "Thread",
        workspaceId: "workspace-1",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        metadata: {
          agentEnabled: true,
        },
        messages: [
          {
            id: "assistant-1",
            threadId: "thread-1",
            role: "assistant",
            parts: [],
            createdAt: "2025-01-01T00:00:00.000Z",
            parentId: "user-1",
            status: "streaming",
            metadata: {},
          },
        ],
      },
    ];

    await act(async () => {
      render(<UChatThread />);
    });

    assert.ok(screen.getByText(i18n.t("chat.thread.agent.running")));
  });

});
