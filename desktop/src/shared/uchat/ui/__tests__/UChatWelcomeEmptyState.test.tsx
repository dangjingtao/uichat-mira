// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemePresetId } from "@/shared/theme/colorThemes";
import { UChatWelcomeEmptyState } from "../UChatWelcomeEmptyState";

const themeState = vi.hoisted(() => ({
  colorTheme: "warm-neutral" as ThemePresetId,
}));

vi.mock("@/app/providers/ThemeProvider", () => ({
  useThemePreferences: () => ({
    colorTheme: themeState.colorTheme,
    themeMode: "light",
    setColorTheme: () => {},
    setThemeMode: () => {},
    themePresets: [],
  }),
}));

vi.mock("@/shared/appMeta", () => ({
  appPackageMeta: { displayName: "UIChat Mira" },
}));

vi.mock("@/assets/branding/welcome-astronaut-hero.png", () => ({
  default: "/hero-warm-neutral.png",
}));
vi.mock("@/assets/branding/welcome-astronaut-hero-archive-green.png", () => ({
  default: "/hero-archive-green.png",
}));
vi.mock("@/assets/branding/welcome-astronaut-hero-knowledge-blue.png", () => ({
  default: "/hero-knowledge-blue.png",
}));
vi.mock("@/assets/branding/welcome-astronaut-hero-slate-ocean.png", () => ({
  default: "/hero-slate-ocean.png",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("UChatWelcomeEmptyState", () => {
  beforeEach(() => {
    themeState.colorTheme = "warm-neutral";
  });

  it("renders welcome content when visible", () => {
    const { container } = render(
      <UChatWelcomeEmptyState activeThreadId="thread-1" isVisible />,
    );

    expect(screen.getByText("UIChat Mira")).toBeInTheDocument();
    expect(
      screen.getByText("chat.thread.welcome.description"),
    ).toBeInTheDocument();
    expect(container.textContent).toContain("chat.thread.welcome.titlePrefix");
    expect(container.textContent).toContain(
      "chat.thread.welcome.titleHighlight",
    );
    expect(container.textContent).toContain("chat.thread.welcome.titleSuffix");
  });

  it("hides content when not visible", () => {
    const { container } = render(
      <UChatWelcomeEmptyState activeThreadId="thread-1" isVisible={false} />,
    );
    expect(container.firstChild).toHaveClass("opacity-0");
    expect(container.firstChild).toHaveClass("pointer-events-none");
  });

  it("uses warm-neutral hero by default", () => {
    render(<UChatWelcomeEmptyState activeThreadId="thread-1" isVisible />);
    const img = document.querySelector("img[src='/hero-warm-neutral.png']");
    expect(img).toBeInTheDocument();
  });

  it("switches hero image for archive-green theme", () => {
    themeState.colorTheme = "archive-green";
    render(<UChatWelcomeEmptyState activeThreadId="thread-1" isVisible />);
    const img = document.querySelector("img[src='/hero-archive-green.png']");
    expect(img).toBeInTheDocument();
  });

  it("switches hero image for knowledge-blue theme", () => {
    themeState.colorTheme = "knowledge-blue";
    render(<UChatWelcomeEmptyState activeThreadId="thread-1" isVisible />);
    const img = document.querySelector("img[src='/hero-knowledge-blue.png']");
    expect(img).toBeInTheDocument();
  });

  it("switches hero image for slate-ocean theme", () => {
    themeState.colorTheme = "slate-ocean";
    render(<UChatWelcomeEmptyState activeThreadId="thread-1" isVisible />);
    const img = document.querySelector("img[src='/hero-slate-ocean.png']");
    expect(img).toBeInTheDocument();
  });

  it("falls back to warm-neutral hero for unknown theme", () => {
    themeState.colorTheme = "unknown-theme" as ThemePresetId;
    render(<UChatWelcomeEmptyState activeThreadId="thread-1" isVisible />);
    const img = document.querySelector("img[src='/hero-warm-neutral.png']");
    expect(img).toBeInTheDocument();
  });
});
