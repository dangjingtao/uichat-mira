// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { settingsRoutes, useSettingsNavigationItems } from "./settingsRoutes";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock("@/features/Settings/pages/About/index", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/General/index", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Account/index", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/KnowledgeBase/pages/index", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/KnowledgeBase/pages/Add", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/KnowledgeBase/pages/Detail", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/ModelSetting", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Evaluation/pages/New", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Evaluation/pages/Center", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Development/index", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Development/pages/Logs", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Development/pages/Database", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Development/pages/ClientTests", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Development/pages/ServerTests", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Development/pages/Docs", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Development/pages/ApiDocs", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Development/pages/BaseInformation", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Tools/index", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Mcp", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/Personas/index", () => ({
  default: () => null,
}));

function NavigationProbe() {
  const items = useSettingsNavigationItems();

  return (
    <ul>
      {items.map((item) => (
        <li key={item.to}>
          {item.label}:{item.to}
        </li>
      ))}
    </ul>
  );
}

describe("settings routes", () => {
  it("includes mcp route in route objects", () => {
    expect(settingsRoutes.some((route) => route.path === "mcp")).toBe(true);
  });

  it("includes the enterprise integrations route", () => {
    expect(settingsRoutes.some((route) => route.path === "integrations")).toBe(true);
  });

  it("includes the logs subpage under /settings/development", () => {
    const developmentRoute = settingsRoutes.find(
      (route) => route.path === "development",
    );

    expect(
      developmentRoute?.children?.some((route) => route.path === "logs"),
    ).toBe(true);
  });

  it("includes mcp route in navigation items", () => {
    render(
      <MemoryRouter>
        <NavigationProbe />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("settings.navigation.mcp:/settings/mcp"),
    ).toBeInTheDocument();
  });

  it("keeps the development route as the only development sidebar navigation item", () => {
    render(
      <MemoryRouter>
        <NavigationProbe />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("settings.navigation.development:/settings/development"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "settings.navigation.developmentLogs:/settings/development/logs",
      ),
    ).not.toBeInTheDocument();
  });
});
