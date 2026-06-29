// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { UChatSidebarView } from "./UChatSidebarView";

const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "chat.sidebar.newConversation": "New Conversation",
        "chat.sidebar.untitledConversation": "Untitled",
        "chat.sidebar.archive": "Archive",
        "chat.sidebar.delete": "Delete",
        "chat.sidebar.workspaces": "Workspaces",
        "chat.sidebar.workspaceCreate": "Create Workspace",
        "chat.sidebar.workspaceAddThread": "Add to Workspace",
        "common.actions.more": "More",
        "common.status.loading": "Loading",
      },
    },
  },
});

describe("UChatSidebarView", () => {
  it("renders pluggable sidebar entries and forwards click events", async () => {
    const user = userEvent.setup();
    const onSidebarEntryClick = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[]}
          activeThreadId={null}
          threadListStatus="ready"
          capabilities={{}}
          sidebarEntries={[
            {
              id: "chat-search",
              label: "Chat Search",
              description: "Find threads",
            },
            {
              id: "workspace",
              label: "Workspace",
              description: "Switch workspace root",
              badge: "Bound",
            },
          ]}
          onCreateThread={() => {}}
          onSidebarEntryClick={onSidebarEntryClick}
          onSelectThread={() => {}}
          onArchiveThread={() => {}}
          onDeleteThread={() => {}}
        />
      </I18nextProvider>,
    );

    expect(screen.getByText("Chat Search")).toBeInTheDocument();
    expect(screen.getAllByTestId("chat-search-icon").length).toBeGreaterThan(0);
    expect(screen.getByText("Workspace")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Chat Search/i }));
    expect(onSidebarEntryClick).toHaveBeenCalledWith(
      expect.objectContaining({ id: "chat-search" }),
    );
  });

  it("uses the thread-style dropdown for workspace actions", async () => {
    const user = userEvent.setup();
    const onDeleteWorkspace = vi.fn();
    const onAddThreadToWorkspace = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[]}
          activeThreadId={null}
          threadListStatus="ready"
          capabilities={{}}
          workspaceGroups={[
            {
              id: "workspace-1",
              name: "Project Alpha",
              threads: [{ id: "thread-1", title: "Thread A", updatedAt: "2026-01-01T00:00:00.000Z" }],
            },
          ]}
          onCreateThread={() => {}}
          onSelectThread={() => {}}
          onArchiveThread={() => {}}
          onDeleteThread={() => {}}
          onDeleteWorkspace={onDeleteWorkspace}
          onAddThreadToWorkspace={onAddThreadToWorkspace}
        />
      </I18nextProvider>,
    );

    expect(screen.getByText("Workspaces")).toBeInTheDocument();
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Thread A")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /More/i }));
    await user.click(screen.getByRole("menuitem", { name: "Add to Workspace" }));
    expect(onAddThreadToWorkspace).toHaveBeenCalledWith("workspace-1");

    await user.click(screen.getByRole("button", { name: /More/i }));
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDeleteWorkspace).toHaveBeenCalledWith("workspace-1");
  });

  it("opens workspace creation directly from the workspace header plus button", async () => {
    const user = userEvent.setup();
    const onCreateWorkspace = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[]}
          activeThreadId={null}
          threadListStatus="ready"
          capabilities={{}}
          sidebarEntries={[]}
          workspaceGroups={[
            {
              id: "workspace-1",
              name: "Project Alpha",
              threads: [],
            },
          ]}
          onCreateThread={() => {}}
          onCreateWorkspace={onCreateWorkspace}
          onSelectThread={() => {}}
          onArchiveThread={() => {}}
          onDeleteThread={() => {}}
        />
      </I18nextProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Create Workspace" }));
    expect(onCreateWorkspace).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Workspaces")).toBeInTheDocument();
  });

  it("keeps the workspace create entry visible even when there are no workspaces yet", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[]}
          activeThreadId={null}
          threadListStatus="ready"
          capabilities={{}}
          workspaceGroups={[]}
          onCreateThread={() => {}}
          onCreateWorkspace={() => {}}
          onSelectThread={() => {}}
          onArchiveThread={() => {}}
          onDeleteThread={() => {}}
        />
      </I18nextProvider>,
    );

    expect(screen.getByText("Workspaces")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Workspace" })).toBeInTheDocument();
  });

  it("toggles workspace collapse from the workspace header", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[]}
          activeThreadId={null}
          threadListStatus="ready"
          capabilities={{}}
          workspaceGroups={[
            {
              id: "workspace-1",
              name: "Project Alpha",
              threads: [{ id: "thread-1", title: "Thread A", updatedAt: "2026-01-01T00:00:00.000Z" }],
            },
          ]}
          onCreateThread={() => {}}
          onSelectThread={() => {}}
          onArchiveThread={() => {}}
          onDeleteThread={() => {}}
        />
      </I18nextProvider>,
    );

    expect(screen.getByText("Thread A")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Project Alpha" }));

    expect(screen.queryByText("Thread A")).not.toBeInTheDocument();
  });

  it("shows the workspace root path in a tooltip on hover", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[]}
          activeThreadId={null}
          threadListStatus="ready"
          capabilities={{}}
          workspaceGroups={[
            {
              id: "workspace-1",
              name: "Project Alpha",
              rootPath: "D:\\workspace\\project-alpha",
              threads: [],
            },
          ]}
          onCreateThread={() => {}}
          onSelectThread={() => {}}
          onArchiveThread={() => {}}
          onDeleteThread={() => {}}
        />
      </I18nextProvider>,
    );

    await user.hover(screen.getByText("Project Alpha"));

    expect(
      await screen.findByText("D:\\workspace\\project-alpha"),
    ).toBeInTheDocument();
  });
});
