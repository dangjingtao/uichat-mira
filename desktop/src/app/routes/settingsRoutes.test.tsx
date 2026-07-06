// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom";
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
vi.mock("@/features/Settings/pages/MicroApps/index", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/MicroApps/Detail", () => ({
  default: () => null,
}));
vi.mock("@/features/Settings/pages/MicroApps/ImageGeneration", () => ({
  default: () => <div data-testid="image-generation-studio-page">image-generation-studio-page</div>,
}));
vi.mock("@/features/Settings/pages/MicroApps/ComputerUse", () => ({
  default: () => <div data-testid="computer-use-studio-page">computer-use-studio-page</div>,
}));
vi.mock("@/features/Settings/pages/MicroApps/MailCenter", () => ({
  default: () => <div data-testid="mail-center-page">mail-center-page</div>,
}));

function NavigationProbe() {
  const items = useSettingsNavigationItems();

  return (
    <ul>
      {items.map((item) => (
        <li key={item.to}>
          {item.label}:{item.to}:{item.group}:{item.order}:{item.match}:{String(item.preserveSearch)}
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
      screen.getByText("settings.navigation.mcp:/settings/mcp:basic:30:exact:false"),
    ).toBeInTheDocument();
  });

  it("keeps the development route as the only development sidebar navigation item", () => {
    render(
      <MemoryRouter>
        <NavigationProbe />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("settings.navigation.development:/settings/development:other:10:prefix:false"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "settings.navigation.developmentLogs:/settings/development/logs",
      ),
    ).not.toBeInTheDocument();
  });

  it("marks knowledge base navigation as prefix-matched for deep pages", () => {
    render(
      <MemoryRouter>
        <NavigationProbe />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("settings.navigation.knowledgeBase:/settings/knowledge-base:knowledge:10:prefix:true"),
    ).toBeInTheDocument();
  });

  it("includes micro apps route in navigation items", () => {
    render(
      <MemoryRouter>
        <NavigationProbe />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("settings.navigation.microApps:/settings/micro-apps:app:15:prefix:false"),
    ).toBeInTheDocument();
  });

  it("marks micro apps navigation as prefix-matched for detail pages", () => {
    render(
      <MemoryRouter>
        <NavigationProbe />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("settings.navigation.microApps:/settings/micro-apps:app:15:prefix:false"),
    ).toBeInTheDocument();
  });

  it("includes the image generation studio route under the micro apps path", () => {
    expect(
      settingsRoutes.some(
        (route) => route.path === "micro-apps/image-generation-studio",
      ),
    ).toBe(true);
  });

  it("mounts the image generation studio page at /settings/micro-apps/image-generation-studio", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/settings",
          children: settingsRoutes,
        },
      ],
      {
        initialEntries: ["/settings/micro-apps/image-generation-studio"],
      },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByTestId("image-generation-studio-page")).toBeInTheDocument();
  });

  it("includes the computer use studio route under the micro apps path", () => {
    expect(
      settingsRoutes.some(
        (route) => route.path === "micro-apps/computer-use-studio",
      ),
    ).toBe(true);
  });

  it("mounts the computer use studio page at /settings/micro-apps/computer-use-studio", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/settings",
          children: settingsRoutes,
        },
      ],
      {
        initialEntries: ["/settings/micro-apps/computer-use-studio"],
      },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByTestId("computer-use-studio-page")).toBeInTheDocument();
  });

  it("includes the mail center route under the micro apps path", () => {
    expect(
      settingsRoutes.some(
        (route) => route.path === "micro-apps/mail-center",
      ),
    ).toBe(true);
  });

  it("mounts the mail center page at /settings/micro-apps/mail-center", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/settings",
          children: settingsRoutes,
        },
      ],
      {
        initialEntries: ["/settings/micro-apps/mail-center"],
      },
    );

    render(<RouterProvider router={router} />);

    expect(screen.getByTestId("mail-center-page")).toBeInTheDocument();
  });
});
