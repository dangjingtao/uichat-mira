// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import MicroAppsSettings from "../index";

const apiMocks = vi.hoisted(() => ({
  getIntegrationCapabilityMicroAppBinding: vi.fn(),
  getIntegrationInstances: vi.fn(),
  getIntegrationMicroApps: vi.fn(),
  getMicroAppCapabilities: vi.fn(),
  openCapabilityBindingModal: vi.fn(),
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

vi.mock("@/shared/api/microAppCapabilities", () => ({
  getMicroAppCapabilities: apiMocks.getMicroAppCapabilities,
}));

vi.mock("../CapabilityBindingModal", () => ({
  openCapabilityBindingModal: apiMocks.openCapabilityBindingModal,
}));

describe("MicroAppsSettings", () => {
  beforeEach(() => {
    apiMocks.getIntegrationMicroApps.mockResolvedValue({
      microApps: [],
    });
    apiMocks.getIntegrationInstances.mockResolvedValue({
      instances: [],
    });
    apiMocks.getMicroAppCapabilities.mockResolvedValue([]);
    apiMocks.getIntegrationCapabilityMicroAppBinding.mockReset();
    apiMocks.openCapabilityBindingModal.mockReset();
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
    expect(screen.getByTestId("micro-apps-loading-grid")).toHaveClass(
      "grid-cols-2",
      "xl:grid-cols-3",
    );
    expect(
      screen.queryByText("settings.microApps.states.loading"),
    ).not.toBeInTheDocument();
  });

  it("renders compact studio cards and opens capability configuration from the hover menu", async () => {
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

    expect(screen.getByTestId("micro-apps-studio-grid")).toHaveClass(
      "grid-cols-2",
      "xl:grid-cols-3",
      "pb-6",
    );
    expect(screen.getByTestId("micro-apps-capability-filters")).toBeInTheDocument();
    const resultsScroll = screen.getByTestId("micro-apps-results-scroll");
    expect(resultsScroll).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
    );
    expect(resultsScroll).not.toContainElement(
      screen.getByTestId("micro-apps-capability-filters"),
    );
    expect(
      screen.getByRole("button", { name: "settings.microApps.filters.all" }),
    ).toHaveAttribute("aria-pressed", "true");
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
      screen.queryByText("settings.microApps.studioEntries.computerUse.badges.focus"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /settings\.microApps\.studioEntries\.computerUse\.actions\.open/,
      }),
    ).toHaveAttribute("href", "/settings/micro-apps/computer-use-studio");
    expect(
      screen.getByRole("link", {
        name: /settings\.microApps\.studioEntries\.computerUse\.actions\.open/,
      }).parentElement,
    ).toHaveClass("min-h-[132px]");
    expect(screen.getByTestId("studio-entry-icon-newsHub")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-icon-mailCenter")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-icon-imageGeneration")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-icon-ttsStudio")).toBeInTheDocument();
    const notionIcon = screen.getByTestId("studio-entry-icon-notion");
    expect(notionIcon).toHaveClass("text-icon-secondary");
    expect(notionIcon.className).not.toMatch(/\bbg-/);
    expect(notionIcon.className).not.toMatch(/\bp-/);
    expect(notionIcon).not.toHaveClass("h-11", "w-11", "rounded-[11px]");
    expect(screen.getByTestId("studio-entry-icon-github").querySelector("svg")).toHaveClass(
      "h-7",
      "w-7",
    );
    expect(screen.getByTestId("studio-entry-menu-imageGeneration")).toHaveClass("md:opacity-0");
    expect(screen.getByTestId("studio-entry-menu-imageGeneration")).toHaveClass("md:group-hover/card:opacity-100");
    expect(screen.getByTestId("studio-entry-menu-ttsStudio")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-icon-codeGraph")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-capability-jianXing-toolkit")).toHaveTextContent(
      "settings.microApps.capabilityTags.toolkit",
    );
    expect(screen.getByTestId("studio-entry-capability-notion-basic")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-capability-officeSuite-skill")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-capability-newsHub-mcp")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-capability-mailCenter-mcp")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-capability-computerUse-toolkit")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-capability-imageGeneration-basic")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-capability-ttsStudio-basic")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-capability-codeGraph-toolkit")).toBeInTheDocument();
    expect(screen.getByTestId("studio-entry-capability-github-toolkit")).toBeInTheDocument();
    expect(
      screen.queryByTestId(/studio-entry-capability-evolvingKnowledge/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("settings.microApps.studioEntries.imageGeneration.badges.focus"),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("studio-entry-menu-imageGeneration"));
    expect(
      screen.getByRole("menuitem", {
        name: "settings.microApps.capabilityBinding.configure",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "编辑" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "下载" })).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("menuitem", {
        name: "settings.microApps.capabilityBinding.configure",
      }),
    );
    expect(apiMocks.openCapabilityBindingModal).toHaveBeenCalledWith(
      expect.objectContaining({ capability: "imageGeneration" }),
    );
    expect(screen.getByTestId("micro-apps-studio-grid")).toBeInTheDocument();
  });

  it("filters cards by capability without adding a visible tag to unclassified apps", async () => {
    render(
      <MemoryRouter initialEntries={["/settings/micro-apps"]}>
        <Routes>
          <Route path="/settings/micro-apps" element={<MicroAppsSettings />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId("micro-apps-capability-filters");

    await userEvent.click(
      screen.getByRole("button", { name: "settings.microApps.filters.skill" }),
    );
    expect(screen.getByTestId("studio-entry-card-officeSuite")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-entry-card-notion")).not.toBeInTheDocument();
    expect(screen.queryByTestId("studio-entry-card-evolvingKnowledge")).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "settings.microApps.filters.unclassified" }),
    );
    expect(screen.getByTestId("studio-entry-card-evolvingKnowledge")).toBeInTheDocument();
    expect(
      screen.queryByTestId(/studio-entry-capability-evolvingKnowledge/),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("studio-entry-card-officeSuite")).not.toBeInTheDocument();
  });

  it("expands the search control and filters cards locally", async () => {
    render(
      <MemoryRouter initialEntries={["/settings/micro-apps"]}>
        <Routes>
          <Route path="/settings/micro-apps" element={<MicroAppsSettings />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId("micro-apps-capability-filters");
    expect(screen.getByTestId("micro-apps-search-control")).toHaveClass("w-8");

    await userEvent.click(
      screen.getByRole("button", { name: "settings.microApps.search.ariaLabel" }),
    );
    const searchInput = screen.getByRole("textbox", {
      name: "settings.microApps.search.ariaLabel",
    });
    expect(screen.getByTestId("micro-apps-search-control")).toHaveClass("w-40");

    await userEvent.type(searchInput, "notion");
    expect(screen.getByTestId("studio-entry-card-notion")).toBeInTheDocument();
    expect(screen.queryByTestId("studio-entry-card-officeSuite")).not.toBeInTheDocument();

    await userEvent.clear(searchInput);
    await userEvent.type(searchInput, "no-such-micro-app");
    expect(
      screen.getByText("settings.microApps.search.emptyTitle"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("micro-apps-studio-grid")).not.toBeInTheDocument();
  });

  it("renders real micro app cards with the same compact shell style as studio cards", async () => {
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
    expect(microAppCard).toHaveClass("group");
    expect(microAppCard.firstChild).toHaveClass("border-border");
    expect(microAppCard.firstChild).toHaveClass("min-h-[132px]");
    expect(microAppCard.firstChild).toHaveClass("overflow-hidden");
    expect(
      screen.getByTestId("micro-app-capability-microapp-knowledge-query-basic"),
    ).toHaveTextContent("settings.microApps.capabilityTags.basic");
    expect(screen.queryByText("settings.microApps.labels.enabled")).not.toBeInTheDocument();
    expect(screen.queryByText("支持接入点")).not.toBeInTheDocument();
    expect(screen.queryByText("配置字段")).not.toBeInTheDocument();
    expect(screen.queryByText("settings.microApps.labels.supportsWecomSmartRobot")).not.toBeInTheDocument();
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

  it("renders a visible CodeGraph Studio entry with a dedicated route", async () => {
    render(
      <MemoryRouter initialEntries={["/settings/micro-apps"]}>
        <Routes>
          <Route path="/settings/micro-apps" element={<MicroAppsSettings />} />
        </Routes>
      </MemoryRouter>,
    );

    const entryLink = await screen.findByRole("link", {
      name: /settings\.microApps\.studioEntries\.codeGraph\.actions\.open/,
    });

    expect(
      screen.getByText("settings.microApps.studioEntries.codeGraph.title"),
    ).toBeInTheDocument();
    expect(entryLink).toHaveAttribute(
      "href",
      "/settings/micro-apps/codegraph-studio",
    );
  });
});
