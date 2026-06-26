// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { SettingsNavigation } from "./layoutShared";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock("@/app/routes/settingsRoutes", () => ({
  useSettingsNavigationItems: () => [
    { label: "settings.navigation.general", icon: () => null, to: "/settings/general" },
    { label: "settings.navigation.model", icon: () => null, to: "/settings/model-setting" },
    { label: "settings.navigation.tools", icon: () => null, to: "/settings/tools" },
    { label: "settings.navigation.mcp", icon: () => null, to: "/settings/mcp" },
    { label: "settings.navigation.knowledgeBase", icon: () => null, to: "/settings/knowledge-base" },
    { label: "settings.navigation.evaluationCenter", icon: () => null, to: "/settings/evaluation/center" },
    { label: "settings.navigation.roles", icon: () => null, to: "/settings/roles" },
    { label: "settings.navigation.development", icon: () => null, to: "/settings/development" },
    { label: "settings.navigation.about", icon: () => null, to: "/settings/about" },
  ],
}));

describe("SettingsNavigation", () => {
  it("renders the requested section headings", () => {
    render(
      <MemoryRouter>
        <SettingsNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByText("settings.navigation.basicConfig")).toBeInTheDocument();
    expect(screen.getByText("settings.navigation.knowledgeGroup")).toBeInTheDocument();
    expect(screen.getByText("settings.navigation.appGroup")).toBeInTheDocument();
    expect(screen.getByText("settings.navigation.otherGroup")).toBeInTheDocument();
    expect(
      screen.queryByText("settings.navigation.developmentLogs"),
    ).not.toBeInTheDocument();
  });
});
