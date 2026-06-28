// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import About from "../index";

const mockAppMeta = {
  name: "ui-chat-mira",
  version: "0.7.1",
  displayName: "UIChat Mira",
  author: "Tomz Dang",
  description: "Test app",
  repositoryUrl: "",
  homepageUrl: "",
  links: [],
};

const getAppMetaMock = vi.fn(async () => mockAppMeta);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.returnObjects && key === "settings.about.brand.paragraphs") {
        return ["Paragraph one", "Paragraph two"];
      }
      return key;
    },
  }),
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  isDesktopShell: () => true,
  getApiBaseUrl: () => "http://127.0.0.1:8787",
}));

vi.mock("@/shared/api/system", () => ({
  getAppMeta: () => getAppMetaMock(),
}));

describe("About", () => {
  it("renders app meta from API in desktop shell", async () => {
    render(<About />);

    await waitFor(() => {
      expect(screen.getByText("UIChat Mira 0.7.1")).toBeInTheDocument();
    });
    expect(getAppMetaMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to fallback meta when API fails", async () => {
    getAppMetaMock.mockRejectedValueOnce(new Error("network error"));

    render(<About />);

    await waitFor(() => {
      expect(screen.getByText("UIChat Mira 0.0.0")).toBeInTheDocument();
    });
  });

  it("renders brand story paragraphs", async () => {
    render(<About />);

    await waitFor(() => {
      expect(screen.getByText("Paragraph one")).toBeInTheDocument();
      expect(screen.getByText("Paragraph two")).toBeInTheDocument();
    });
  });
});
