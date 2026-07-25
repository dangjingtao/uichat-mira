// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GitHubMicroAppPage from "./index";

const apiMocks = vi.hoisted(() => ({
  disconnectGitHub: vi.fn(),
  getGitHubConnection: vi.fn(),
  getGitHubRepositories: vi.fn(),
  pollGitHubDeviceFlow: vi.fn(),
  startGitHubDeviceFlow: vi.fn(),
  validateGitHubConnection: vi.fn(),
}));

vi.mock("@/shared/api/github", () => apiMocks);

vi.mock("@/shared/ui/Message", () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getApiBaseUrl: () => "/api",
  openExternalUrl: vi.fn(),
}));

describe("GitHubMicroAppPage", () => {
  it("moves project selection and management actions into the connection summary", async () => {
    apiMocks.getGitHubConnection.mockResolvedValue({
      connection: {
        id: "github-1",
        clientId: "client-1",
        appSlug: "mira-test",
        enabled: true,
        status: "connected",
        hasToken: true,
        userId: "user-1",
        login: "mira-user",
        avatarUrl: null,
        tokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        lastValidatedAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
      installUrl: "https://github.com/apps/mira-test/installations/new",
    });
    apiMocks.getGitHubRepositories.mockResolvedValue({
      repositoryCount: 1,
      installations: [
        {
          id: "installation-1",
          account: {
            id: "account-1",
            login: "mira-org",
            avatarUrl: null,
            type: "Organization",
          },
          repositorySelection: "selected",
          permissions: {},
          manageUrl: "https://github.com/settings/installations/installation-1",
          repositories: [
            {
              id: "repository-1",
              name: "mira",
              fullName: "mira-org/mira",
              private: false,
              htmlUrl: "https://github.com/mira-org/mira",
              defaultBranch: "main",
              permissions: {},
            },
          ],
        },
      ],
    });

    render(<GitHubMicroAppPage />);

    await waitFor(() => {
      expect(screen.getByTestId("github-project-actions")).toBeInTheDocument();
    });

    const summary = screen.getByTestId("github-connection-summary");
    expect(within(summary).getByTestId("github-select-project")).toHaveAttribute(
      "href",
      "https://github.com/apps/mira-test/installations/new",
    );
    expect(
      within(summary).getByTestId("github-manage-project-installation-1"),
    ).toHaveAttribute(
      "href",
      "https://github.com/settings/installations/installation-1",
    );

    const installation = screen.getByTestId("github-installation-installation-1");
    expect(within(installation).queryByText("选择项目")).not.toBeInTheDocument();
    expect(within(installation).queryByText("调整项目")).not.toBeInTheDocument();
    expect(within(installation).queryByText("指定项目")).not.toBeInTheDocument();
    expect(within(installation).queryByText("1 个仓库")).not.toBeInTheDocument();
    expect(within(installation).getByText("mira-org/mira")).toBeInTheDocument();
    const projectContent = screen.getByTestId("github-project-content");
    expect(projectContent).toHaveClass("min-h-0", "flex-1");
    expect(projectContent).not.toHaveClass(
      "xl:grid-cols-[minmax(0,1fr)_340px]",
    );
    expect(screen.getByTestId("github-authorized-projects-card")).toHaveClass(
      "h-full",
      "min-h-0",
      "overflow-hidden",
    );
    expect(screen.getByTestId("github-authorized-projects-scroll")).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
    );
    expect(projectContent.parentElement?.parentElement).not.toHaveClass(
      "overflow-y-auto",
    );
    expect(screen.queryByText("项目由你决定")).not.toBeInTheDocument();
    expect(screen.queryByText("连接后可以做什么")).not.toBeInTheDocument();
  });
});
