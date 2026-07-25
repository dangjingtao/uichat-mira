// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import About from "../index";

const runtimeMock = vi.hoisted(() => ({
  hostKind: "electron" as "browser" | "electron" | "tauri",
  platform: "win32",
  isPackaged: true,
  backendUrl: "http://127.0.0.1:8787",
}));

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
  isDesktopShell: (runtime: { hostKind: string }) =>
    runtime.hostKind !== "browser",
  getDesktopRuntime: () => runtimeMock,
  getApiBaseUrl: () => "http://127.0.0.1:8787",
}));

vi.mock("@/shared/api/system", () => ({
  getAppMeta: () => getAppMetaMock(),
}));

describe("About", () => {
  beforeEach(() => {
    runtimeMock.hostKind = "electron";
    runtimeMock.platform = "win32";
    runtimeMock.isPackaged = true;
    getAppMetaMock.mockClear();
  });

  it("renders app meta from API in desktop shell", async () => {
    render(<About />);

    await waitFor(() => {
      expect(screen.getByText("UIChat Mira")).toBeInTheDocument();
      expect(
        screen.getByText("v0.7.1 · Windows · Electron"),
      ).toBeInTheDocument();
    });
    expect(getAppMetaMock).toHaveBeenCalledTimes(1);
  });

  it("renders the current Tauri host and operating system beside the version", async () => {
    runtimeMock.hostKind = "tauri";
    runtimeMock.platform = "darwin";

    render(<About />);

    await waitFor(() => {
      expect(
        screen.getByText("v0.7.1 · macOS · Tauri"),
      ).toBeInTheDocument();
    });
  });

  it("falls back to fallback meta when API fails", async () => {
    getAppMetaMock.mockRejectedValueOnce(new Error("network error"));

    render(<About />);

    await waitFor(() => {
      expect(
        screen.getByText("v0.0.0 · Windows · Electron"),
      ).toBeInTheDocument();
    });
  });

  it("renders brand story paragraphs", async () => {
    render(<About />);

    await waitFor(() => {
      expect(screen.getByText("Paragraph one")).toBeInTheDocument();
      expect(screen.getByText("Paragraph two")).toBeInTheDocument();
    });

    const brandStory = screen.getByTestId("about-brand-story");
    expect(brandStory.tagName).toBe("ARTICLE");
    expect(brandStory).toHaveClass("max-w-3xl");
    expect(screen.getByText("Paragraph one")).toHaveClass("text-text-primary");
    expect(screen.getByText("Paragraph two")).toHaveClass(
      "font-medium",
      "text-text-primary",
    );
  });
});
