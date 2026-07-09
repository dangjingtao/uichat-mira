// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MicroAppsSettings from "../index";

const apiMocks = vi.hoisted(() => ({
  getIntegrationCapabilityMicroAppBinding: vi.fn(),
  getIntegrationInstances: vi.fn(),
  getIntegrationMicroApps: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/shared/api/integrations", () => ({
  getIntegrationCapabilityMicroAppBinding:
    apiMocks.getIntegrationCapabilityMicroAppBinding,
  getIntegrationInstances: apiMocks.getIntegrationInstances,
  getIntegrationMicroApps: apiMocks.getIntegrationMicroApps,
}));

describe("MicroAppsSettings", () => {
  beforeEach(() => {
    apiMocks.getIntegrationMicroApps.mockResolvedValue({
      microApps: [],
    });
    apiMocks.getIntegrationInstances.mockResolvedValue({
      instances: [],
    });
    apiMocks.getIntegrationCapabilityMicroAppBinding.mockReset();
  });

  it("shows a skeleton layout instead of a loading status card on first entry", () => {
    apiMocks.getIntegrationMicroApps.mockReturnValue(new Promise(() => {}));
    apiMocks.getIntegrationInstances.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={["/settings/micro-apps"]}>
        <Routes>
          <Route path="/settings/micro-apps" element={<MicroAppsSettings />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("micro-apps-loading-skeleton")).toBeInTheDocument();
    expect(
      screen.queryByText("settings.microApps.states.loading"),
    ).not.toBeInTheDocument();
  });

  it("renders a visible computer use studio entry from the micro apps list", async () => {
    render(
      <MemoryRouter initialEntries={["/settings/micro-apps"]}>
        <Routes>
          <Route path="/settings/micro-apps" element={<MicroAppsSettings />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("settings.microApps.studioEntries.computerUse.title"),
      ).toBeInTheDocument();
    });

    expect(screen.getByTestId("micro-apps-studio-grid")).toHaveClass("sm:grid-cols-2");
    expect(screen.getByTestId("micro-apps-studio-grid")).toHaveClass("xl:grid-cols-3");
    expect(
      screen.queryByText("settings.microApps.banner.title"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("settings.microApps.footer.title"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /settings\.microApps\.actions\.refresh/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("settings.microApps.studioEntries.computerUse.description"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-icon-computerUse")).toBeInTheDocument();
    expect(
      screen.queryByText("settings.microApps.studioEntries.computerUse.badges.runtime"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("settings.microApps.studioEntries.computerUse.badges.focus"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /settings\.microApps\.studioEntries\.computerUse\.actions\.open/,
      }),
    ).toHaveAttribute("href", "/settings/micro-apps/computer-use-studio");
    expect(
      screen.getByRole("link", {
        name: /settings\.microApps\.studioEntries\.computerUse\.actions\.open/,
      }),
    ).toHaveClass("bg-transparent");
    expect(
      screen.getByRole("link", {
        name: /settings\.microApps\.studioEntries\.computerUse\.actions\.open/,
      }),
    ).toHaveClass("border-primary/20");
    expect(
      screen.getByRole("link", {
        name: /settings\.microApps\.studioEntries\.computerUse\.actions\.open/,
      }),
    ).toHaveClass("text-primary");
    expect(screen.getByTestId("studio-entry-icon-newsHub")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-icon-mailCenter")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-icon-imageGeneration")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-icon-ttsStudio")).toBeInTheDocument();
    expect(
      screen.queryByText("settings.microApps.studioEntries.imageGeneration.badges.focus"),
    ).not.toBeInTheDocument();
  });

  it("renders real micro app cards with the same highlighted shell style as studio cards", async () => {
    apiMocks.getIntegrationMicroApps.mockResolvedValue({
      microApps: [
        {
          id: "microapp-knowledge-query",
          name: "Default Knowledge Query",
          type: "knowledge_query",
          enabled: true,
          supportedAccessPoints: ["wecom.smart_robot"],
          bindingSchema: {
            fields: [{ key: "knowledgeBaseId" }],
          },
        },
      ],
    });
    apiMocks.getIntegrationInstances.mockResolvedValue({
      instances: [],
    });

    render(
      <MemoryRouter initialEntries={["/settings/micro-apps"]}>
        <Routes>
          <Route path="/settings/micro-apps" element={<MicroAppsSettings />} />
        </Routes>
      </MemoryRouter>,
    );

    const microAppCard = await screen.findByTestId("micro-app-card-microapp-knowledge-query");
    expect(microAppCard).toHaveClass("block");
    expect(microAppCard.firstChild).toHaveClass("border-primary/15");
    expect(microAppCard.firstChild).toHaveClass("bg-primary/5");
    expect(screen.queryByText("settings.microApps.labels.enabled")).not.toBeInTheDocument();
    expect(screen.queryByText("支持接入点")).not.toBeInTheDocument();
    expect(screen.queryByText("配置字段")).not.toBeInTheDocument();
    expect(screen.getByText("settings.microApps.labels.supportsWecomSmartRobot")).toBeInTheDocument();
    expect(screen.queryByText("settings.microApps.labels.boundCount")).not.toBeInTheDocument();
    expect(screen.queryByText("支持绑定企业微信智能机器人")).not.toBeInTheDocument();
    expect(screen.queryByText("接入点绑定时动态填写知识库配置")).not.toBeInTheDocument();
  });

  it("navigates to the computer use studio without typing the route manually", async () => {
    render(
      <MemoryRouter initialEntries={["/settings/micro-apps"]}>
        <Routes>
          <Route path="/settings/micro-apps" element={<MicroAppsSettings />} />
          <Route
            path="/settings/micro-apps/computer-use-studio"
            element={<div data-testid="computer-use-studio-page" />}
          />
        </Routes>
      </MemoryRouter>,
    );

    const entryLink = await screen.findByRole("link", {
      name: /settings\.microApps\.studioEntries\.computerUse\.actions\.open/,
    });

    fireEvent.click(entryLink);

    await waitFor(() => {
      expect(
        screen.getByTestId("computer-use-studio-page"),
      ).toBeInTheDocument();
    });
  });
});
