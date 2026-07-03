// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DevelopmentBaseInformation from "../pages/BaseInformation/index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  isDesktopShell: () => true,
  getApiBaseUrl: () => "http://127.0.0.1:8787",
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
    ],
  })),
}));

describe("DevelopmentBaseInformation", () => {
  it("renders the base information panel", async () => {
    render(<DevelopmentBaseInformation />);

    await waitFor(() => {
      expect(screen.getByText("Tomz Dang")).toBeInTheDocument();
    });
  });
});
