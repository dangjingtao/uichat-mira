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
        "chat.sidebar.historyThreads": "History Threads",
        "chat.sidebar.workspaceCreate": "Create Workspace",
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

  it("uses the thread-style dropdown for workspace deletion", async () => {
    const user = userEvent.setup();
    const onDeleteWorkspace = vi.fn();

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
        />
      </I18nextProvider>,
    );

    expect(screen.getByText("Workspaces")).toBeInTheDocument();
    expect(screen.getByText("Project Alpha")).toBeInTheDocument();
    expect(screen.getByText("Thread ...")).toBeInTheDocument();

    const workspaceHeader = screen.getByRole("button", { name: "Project Alpha" }).closest(".group");
    const workspaceMoreButtons = workspaceHeader?.querySelectorAll('button[aria-label="More"]');
    expect(workspaceMoreButtons?.length).toBeGreaterThan(0);
    await user.click(workspaceMoreButtons?.[0] as HTMLButtonElement);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDeleteWorkspace).toHaveBeenCalledWith("workspace-1");
  });

  it("restores archive and delete actions for history thread dropdown", async () => {
    const user = userEvent.setup();
    const onArchiveThread = vi.fn();
    const onDeleteThread = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[
            {
              id: "thread-1",
              title: "Thread A",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
          activeThreadId="thread-1"
          threadListStatus="ready"
          capabilities={{ archiveThread: true, deleteThread: true }}
          workspaceGroups={[]}
          onCreateThread={() => {}}
          onCreateWorkspace={() => {}}
          onSelectThread={() => {}}
          onArchiveThread={onArchiveThread}
          onDeleteThread={onDeleteThread}
        />
      </I18nextProvider>,
    );

    const threadRow = screen.getByRole("button", { name: "Thread ..." }).closest(".group");
    const historyMoreButton = threadRow?.querySelector('button[aria-label="More"]');
    expect(historyMoreButton).toBeInTheDocument();

    await user.click(historyMoreButton as HTMLButtonElement);
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(onArchiveThread).toHaveBeenCalledWith("thread-1");

    await user.click(historyMoreButton as HTMLButtonElement);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteThread).toHaveBeenCalledWith("thread-1");
  });

  it("truncates thread titles to seven characters plus ellipsis in every section", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[
            {
              id: "history-thread",
              title: "删除 `222.txt` 文件",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          ]}
          activeThreadId={null}
          threadListStatus="ready"
          capabilities={{}}
          workspaceGroups={[
            {
              id: "workspace-1",
              name: "Project Alpha",
              threads: [
                {
                  id: "workspace-thread",
                  title: "删除 `222.txt` 文件",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                },
              ],
            },
          ]}
          onCreateThread={() => {}}
          onCreateWorkspace={() => {}}
          onSelectThread={() => {}}
          onArchiveThread={() => {}}
          onDeleteThread={() => {}}
        />
      </I18nextProvider>,
    );

    expect(screen.getAllByText("删除 `222...")).toHaveLength(2);
    expect(screen.queryByText("删除 `222.txt` 文件")).toBeNull();
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

  it("renders a history threads section header above ungrouped threads", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[
            {
              id: "thread-1",
              title: "Thread A",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
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

    expect(screen.getByText("History Threads")).toBeInTheDocument();
    expect(screen.getByText("Thread ...")).toBeInTheDocument();

    const headerButton = screen.getByRole("button", { name: /History Threads/i });
    const label = screen.getByText("History Threads");
    const chevron = headerButton.querySelector("svg");
    expect(chevron).toBeInTheDocument();
    expect(label.compareDocumentPosition(chevron as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("toggles history threads collapse from the section header", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[
            {
              id: "thread-1",
              title: "Thread A",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
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

    const headerButton = screen.getByRole("button", { name: /History Threads/i });
    await user.click(headerButton);

    const threadButton = screen.getByRole("button", { name: "Thread ..." });
    const collapseContainer = threadButton.closest(".grid");
    expect(collapseContainer?.className).toContain("grid-rows-[0fr]");
    expect(collapseContainer?.className).toContain("opacity-0");
  });

  it("uses the outer sidebar container as the only scroll region for history threads", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[
            {
              id: "thread-1",
              title: "Thread A",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
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

    const outerScrollRegion = container.querySelector(".overflow-y-auto.overscroll-contain");
    expect(outerScrollRegion).toBeInTheDocument();
    expect(outerScrollRegion?.className).toContain("px-2");
    expect(container.querySelector(".h-0.min-h-0.flex-1.overflow-y-auto")).toBeNull();
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

    expect(screen.getByText("Thread ...")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Project Alpha" }));

    const threadButton = screen.getByRole("button", { name: "Thread ..." });
    const collapseContainer = threadButton.closest(".grid");
    expect(collapseContainer?.className).toContain("grid-rows-[0fr]");
    expect(collapseContainer?.className).toContain("opacity-0");
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

  it("keeps long workspace titles inside the sidebar width by allowing the tooltip trigger to shrink", () => {
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
              name: "CODEX TEST FOLDER ALT",
              rootPath: "D:\\workspace\\codex-test-folder-alt",
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

    const title = screen.getByText("CODEX TEST FOLDER ALT");
    expect(title).toHaveClass("truncate");
    expect(title.parentElement).toHaveClass("min-w-0");
    expect(title.parentElement).toHaveClass("max-w-full");
  });

  it("applies the hover highlight style to the active workspace thread", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[]}
          activeThreadId="thread-1"
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

    const threadButton = screen.getByRole("button", { name: "Thread ..." });
    const threadRow = threadButton.closest(".group");

    expect(threadRow?.className).toContain("bg-[rgb(var(--color-primary)/0.04)]");
    expect(threadRow?.className).toContain("text-text-primary");
    expect(threadRow?.querySelector(".bg-primary\\/85")).toBeNull();
  });

  it("applies the hover highlight style to the active history thread", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarView
          threads={[
            {
              id: "thread-1",
              title: "Thread A",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]}
          activeThreadId="thread-1"
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

    const threadButton = screen.getByRole("button", { name: "Thread ..." });
    const threadRow = threadButton.closest(".group");

    expect(threadRow?.className).toContain("bg-[rgb(var(--color-primary)/0.04)]");
    expect(threadRow?.className).toContain("text-text-primary");
    expect(threadRow?.querySelector(".bg-primary\\/85")).toBeNull();
  });
});
