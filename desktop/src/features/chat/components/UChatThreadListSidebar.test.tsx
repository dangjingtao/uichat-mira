// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider, initReactI18next } from "react-i18next";
import i18next from "i18next";

const mockedApis = vi.hoisted(() => ({
  modalConfirmMock: vi.fn(),
  deleteChatWorkspaceMock: vi.fn(),
}));

const mockSidebarState = {
  threads: [
    {
      id: "thread-1",
      title: "Alpha Thread",
      createdAt: "2026-06-27T08:00:00.000Z",
      updatedAt: "2026-06-27T08:00:00.000Z",
      workspaceId: null,
    },
  ],
  activeThreadId: null,
  threadListStatus: "ready",
  capabilities: {},
} as const;

vi.mock("@/features/chat/core/runtime", () => ({
  useChatRuntime: () => ({
    enterWelcomeState: vi.fn(),
    selectThread: vi.fn(),
    archiveThread: vi.fn(),
    deleteThread: vi.fn(),
    refreshThread: vi.fn(),
    store: {
      getState: () => ({ resetComposer: vi.fn() }),
    },
  }),
  useChatRuntimeSelector: (selector: (state: any) => any) =>
    selector(mockSidebarState),
}));

vi.mock("@/shared/api/thread", () => ({
  listChatWorkspaces: async () => [],
  createChatWorkspace: vi.fn(),
  deleteChatWorkspace: mockedApis.deleteChatWorkspaceMock,
  updateThread: vi.fn(),
}));

vi.mock("@/shared/ui", async () => {
  const actual = await vi.importActual("@/shared/ui");
  const actualModal = (actual as { Modal: unknown }).Modal;
  return {
    ...actual,
    Modal: Object.assign(actualModal as object, {
      confirm: mockedApis.modalConfirmMock,
    }),
  };
});

vi.mock("@/shared/uchat/ui", () => ({
  UChatSidebarView: ({
    sidebarEntries = [],
    onSidebarEntryClick,
    onCreateWorkspace,
    onDeleteWorkspace,
  }: {
    sidebarEntries?: Array<{ id: string; label: string }>;
    onSidebarEntryClick?: (entry: { id: string; label: string }) => void | Promise<void>;
    onCreateWorkspace?: () => void | Promise<void>;
    onDeleteWorkspace?: (workspaceId: string) => void | Promise<void>;
  }) => (
    <div>
      {sidebarEntries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => {
            void onSidebarEntryClick?.(entry);
          }}
        >
          {entry.label}
        </button>
      ))}
      <button type="button" onClick={() => void onCreateWorkspace?.()}>
        Create Workspace
      </button>
      <button type="button" onClick={() => void onDeleteWorkspace?.("workspace-1")}>
        Delete Workspace
      </button>
    </div>
  ),
}));

vi.mock("./UChatSidebarToolsModal", () => ({
  UChatSidebarToolsModal: ({
    mode,
    open,
  }: {
    mode: string | null;
    open: boolean;
  }) =>
    open ? (
      <div data-testid="sidebar-tools-modal">{mode}</div>
    ) : null,
}));

import { UChatThreadListSidebar } from "./UChatThreadListSidebar";

const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "chat.sidebar.newConversation": "New Conversation",
        "chat.sidebar.tools.search": "Chat Search",
        "chat.sidebar.workspaceCreate": "Create Workspace",
        "chat.sidebar.workspaceName": "Workspace Name",
        "chat.sidebar.workspaceRootPath": "Workspace Root Path",
        "chat.sidebar.workspaceRootPathInvalid": "Enter a valid absolute directory path",
        "chat.sidebar.workspaceDeleteTitle": "Delete Workspace",
        "chat.sidebar.workspaceDeleteDescription":
          "Deleting this workspace will also delete all threads inside it. This action cannot be undone.",
        "chat.sidebar.workspaceDeleteConfirm": "Delete Workspace",
        "chat.sidebar.untitledConversation": "Untitled",
        "common.actions.cancel": "Cancel",
      },
    },
  },
});

describe("UChatThreadListSidebar", () => {
  it("shows confirmation before deleting a workspace", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatThreadListSidebar />
      </I18nextProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Delete Workspace" }));

    expect(mockedApis.modalConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Delete Workspace",
        description:
          "Deleting this workspace will also delete all threads inside it. This action cannot be undone.",
        confirmText: "Delete Workspace",
        tone: "danger",
      }),
    );
    expect(mockedApis.deleteChatWorkspaceMock).not.toHaveBeenCalled();
  });

  it("opens the search modal from the sidebar entry", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatThreadListSidebar />
      </I18nextProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Chat Search" }));

    expect(screen.getByTestId("sidebar-tools-modal")).toHaveTextContent("search");
  });

  it("shows inline validation for invalid workspace root paths", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatThreadListSidebar />
      </I18nextProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Create Workspace" }));
    await user.type(await screen.findByRole("textbox", { name: "Workspace Name" }), "Project Alpha");
    await user.type(await screen.findByRole("textbox", { name: "Workspace Root Path" }), "D");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Create Workspace" }));

    expect(screen.getByText("Enter a valid absolute directory path")).toBeInTheDocument();
  });
});
