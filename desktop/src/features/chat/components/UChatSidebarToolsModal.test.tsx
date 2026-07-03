// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { UChatSidebarToolsModal } from "./UChatSidebarToolsModal";

const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: {
      translation: {
        "chat.sidebar.tools.searchTitle": "Chat Search",
        "chat.sidebar.tools.searchInputLabel": "Search Threads",
        "chat.sidebar.tools.searchPlaceholder": "Search by thread title or ID",
        "chat.sidebar.tools.searchEmpty": "No matching threads found",
        "chat.sidebar.tools.workspaceTitle": "Workspace",
        "chat.sidebar.tools.workspaceCurrent": "Current Workspace",
        "chat.sidebar.tools.workspaceUnset": "Workspace not set",
        "chat.sidebar.tools.workspaceInputLabel": "Workspace Path",
        "chat.sidebar.tools.workspacePlaceholder": "For example D:\\workspace\\rag-demo",
        "chat.sidebar.tools.workspaceApply": "Apply Workspace",
        "chat.sidebar.tools.currentThread": "Current Thread",
        "chat.sidebar.untitledConversation": "Untitled",
        "common.actions.cancel": "Cancel",
      },
    },
  },
});

describe("UChatSidebarToolsModal", () => {
  it("filters threads in search mode", async () => {
    const user = userEvent.setup();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarToolsModal
          mode="search"
          open
          threads={[
            {
              id: "thread-1",
              title: "Alpha Thread",
              createdAt: "2026-06-27T08:00:00.000Z",
              updatedAt: "2026-06-27T08:00:00.000Z",
            },
            {
              id: "thread-2",
              title: "Beta Thread",
              createdAt: "2026-06-27T09:00:00.000Z",
              updatedAt: "2026-06-27T09:00:00.000Z",
            },
          ]}
          activeThreadId={null}
          workspaceSelection={null}
          workspaceInput=""
          isWorkspaceLoading={false}
          isWorkspaceSubmitting={false}
          onWorkspaceInputChange={() => {}}
          onWorkspaceApply={() => {}}
          onSelectThread={() => {}}
          onClose={() => {}}
        />
      </I18nextProvider>,
    );

    await user.type(
      screen.getByLabelText("Search Threads"),
      "beta",
    );

    expect(screen.queryByText("Alpha Thread")).not.toBeInTheDocument();
    expect(screen.getByText("Beta Thread")).toBeInTheDocument();
  });

  it("submits workspace changes in workspace mode", async () => {
    const user = userEvent.setup();
    const onWorkspaceInputChange = vi.fn();
    const onWorkspaceApply = vi.fn();

    render(
      <I18nextProvider i18n={i18n}>
        <UChatSidebarToolsModal
          mode="workspace"
          open
          threads={[]}
          activeThreadId={null}
          workspaceSelection={{
            rootPath: "D:\\testData",
            source: "selected",
          }}
          workspaceInput="D:\\testData"
          isWorkspaceLoading={false}
          isWorkspaceSubmitting={false}
          onWorkspaceInputChange={onWorkspaceInputChange}
          onWorkspaceApply={onWorkspaceApply}
          onSelectThread={() => {}}
          onClose={() => {}}
        />
      </I18nextProvider>,
    );

    expect(screen.getByText("D:\\testData")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Apply Workspace" }));
    expect(onWorkspaceApply).toHaveBeenCalledTimes(1);
  });
});
