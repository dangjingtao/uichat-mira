// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DevelopmentDocs from "../pages/Docs/index";
import { getDesktopRuntime } from "@/shared/platform/desktopRuntime";

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getDesktopRuntime: vi.fn(),
  isDesktopShell: (runtime: { hostKind: string }) => runtime.hostKind !== "browser",
}));

const mockGetDesktopRuntime = vi.mocked(getDesktopRuntime);

describe("DevelopmentDocs", () => {
  beforeEach(() => {
    mockGetDesktopRuntime.mockReturnValue({
      hostKind: "browser",
      platform: "browser",
      isPackaged: false,
      backendUrl: "",
    });
  });

  it("uses the Vite docs proxy in browser preview", () => {
    render(<DevelopmentDocs />);

    expect(screen.getByTitle("Developer Docs")).toHaveAttribute("src", "/docs/");
  });

  it("uses the backend docs route in desktop shells", () => {
    mockGetDesktopRuntime.mockReturnValue({
      hostKind: "tauri",
      platform: "windows",
      isPackaged: true,
      backendUrl: "http://127.0.0.1:8787",
    });

    render(<DevelopmentDocs />);

    expect(screen.getByTitle("Developer Docs")).toHaveAttribute(
      "src",
      "http://127.0.0.1:8787/docs/",
    );
  });
});
