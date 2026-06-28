// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider, initReactI18next } from "react-i18next";
import i18next from "i18next";

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
  deleteChatWorkspace: vi.fn(),
  updateThread: vi.fn(),
}));

vi.mock("@/shared/uchat/ui", () => ({
  UChatSidebarView: ({
    sidebarEntries = [],
    onSidebarEntryClick,
  }: {
    sidebarEntries?: Array<{ id: string; label: string }>;
    onSidebarEntryClick?: (entry: { id: string; label: string }) => void | Promise<void>;
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
        "chat.sidebar.untitledConversation": "Untitled",
        "common.actions.cancel": "Cancel",
      },
    },
  },
});

describe("UChatThreadListSidebar", () => {
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
});
