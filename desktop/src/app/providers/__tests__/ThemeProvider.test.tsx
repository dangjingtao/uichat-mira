// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useThemePreferences } from "../ThemeProvider";

function Probe() {
  const theme = useThemePreferences();
  return (
    <div>
      <span data-testid="theme">{theme.colorTheme}</span>
      <span data-testid="mode">{theme.themeMode}</span>
      <span data-testid="preset-count">{theme.themePresets.length}</span>
      <button onClick={() => theme.setColorTheme("knowledge-blue")}>blue</button>
      <button onClick={() => theme.setThemeMode("dark")}>dark</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-color-theme");
    document.documentElement.removeAttribute("data-theme-mode");
    document.documentElement.removeAttribute("style");
  });

  it("falls back from invalid storage and applies the theme to the document", async () => {
    localStorage.setItem("uichat-color-theme", "not-a-theme");
    localStorage.setItem("uichat-theme-mode", "system");

    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("theme")).toHaveTextContent("warm-neutral");
    expect(screen.getByTestId("mode")).toHaveTextContent("light");
    expect(Number(screen.getByTestId("preset-count").textContent)).toBeGreaterThan(1);
    expect(document.documentElement).toHaveAttribute(
      "data-color-theme",
      "warm-neutral",
    );
    expect(localStorage.getItem("uichat-theme-mode")).toBe("light");
  });

  it("persists changes and toggles dark document state", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "blue" }));
    await user.click(screen.getByRole("button", { name: "dark" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).toHaveAttribute(
      "data-color-theme",
      "knowledge-blue",
    );
    expect(document.documentElement).toHaveAttribute("data-theme-mode", "dark");
    expect(localStorage.getItem("uichat-color-theme")).toBe("knowledge-blue");
    expect(localStorage.getItem("uichat-theme-mode")).toBe("dark");
  });

  it("requires consumers to be inside the provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      "useThemePreferences must be used within a ThemeProvider",
    );
    errorSpy.mockRestore();
  });
});
