// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import DevelopmentBaseInformation from "../pages/BaseInformation/index";

const uiMocks = vi.hoisted(() => ({
  modalShow: vi.fn(),
  modalClose: vi.fn(),
  openExternalUrl: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  isDesktopShell: () => true,
  getApiBaseUrl: () => "http://127.0.0.1:8787",
  openExternalUrl: uiMocks.openExternalUrl,
}));

vi.mock("@/shared/ui/Modal", () => ({
  Modal: {
    show: uiMocks.modalShow,
    close: uiMocks.modalClose,
  },
}));

vi.mock("@/shared/api/system", () => ({
  getAppMeta: vi.fn(async () => ({
    name: "ui-chat-mira",
    version: "0.7.1",
    displayName: "UIChat Mira",
    author: "Tomz Dang",
    description: "Test app",
    repositoryUrl: "",
    homepageUrl: "",
    links: [
      {
        label: "Author",
        value: "Tomz Dang",
        href: "https://github.com/dangjingtao",
      },
      {
        label: "官方文档",
        value: "https://tomz.io",
        href: "https://tomz.io",
      },
    ],
    git: {
      branch: "codex/feature-test",
      versions: Array.from({ length: 6 }, (_, index) => ({
        version: `0.${index}`,
        commit: {
          hash: `hash-${index}`,
          shortHash: `short-${index}`,
          message: `commit-${index}`,
          author: "Tomz Dang",
          date: "2026-07-26T00:00:00.000Z",
        },
      })),
    },
  })),
}));

describe("DevelopmentBaseInformation", () => {
  it("renders the base information panel", async () => {
    render(<DevelopmentBaseInformation />);

    await waitFor(() => {
      expect(screen.getAllByText("Tomz Dang").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("commit-0")).toBeInTheDocument();
    expect(screen.getByText("commit-4")).toBeInTheDocument();
    expect(screen.queryByText("commit-5")).not.toBeInTheDocument();
    expect(screen.getByTestId("git-version-list")).toHaveClass(
      "overflow-hidden",
      "rounded-ui-panel",
    );
    expect(screen.getByTestId("git-version-0.0")).toHaveClass("border-t");
    expect(screen.getByTestId("git-version-0.0")).not.toHaveClass(
      "rounded-lg",
      "bg-surface-secondary/60",
    );
    expect(screen.getByTestId("base-information-links")).toHaveClass(
      "overflow-hidden",
      "rounded-ui-panel",
    );

    await userEvent.click(screen.getByText("MIT License"));
    expect(uiMocks.modalShow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "MIT License",
        footer: null,
      }),
    );

    await userEvent.click(screen.getByText("CHANGELOG.md"));
    expect(uiMocks.modalShow).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "更新日志",
        footer: null,
      }),
    );

    await userEvent.click(screen.getByText("https://tomz.io"));
    expect(uiMocks.openExternalUrl).toHaveBeenCalledWith("https://tomz.io");

    uiMocks.modalShow.mockReturnValueOnce("feedback-modal");
    await userEvent.click(screen.getByText("应用反馈"));
    const feedbackModal = uiMocks.modalShow.mock.calls.find(
      ([options]) => options.title === "应用反馈",
    )?.[0] as { content: ReactNode } | undefined;
    expect(feedbackModal).toBeDefined();

    render(feedbackModal?.content);
    await userEvent.click(
      screen.getByRole("button", { name: /提交 GitHub Issue/ }),
    );
    await waitFor(() => {
      expect(uiMocks.openExternalUrl).toHaveBeenCalledWith(
        "https://github.com/dangjingtao/uichat-mira/issues/new",
      );
    });

    await userEvent.click(screen.getByRole("button", { name: /发送邮件/ }));
    await waitFor(() => {
      expect(uiMocks.openExternalUrl).toHaveBeenCalledWith(
        "mailto:dangjingtao@gmail.com?subject=UIChat%20Mira%20反馈",
      );
    });
    expect(uiMocks.modalClose).toHaveBeenCalledWith("feedback-modal");
  });
});
