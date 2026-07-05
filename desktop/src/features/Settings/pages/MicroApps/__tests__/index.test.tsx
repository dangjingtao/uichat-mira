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

    expect(
      screen.getByText("settings.microApps.studioEntries.computerUse.description"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /settings\.microApps\.studioEntries\.computerUse\.actions\.open/,
      }),
    ).toHaveAttribute("href", "/settings/micro-apps/computer-use-studio");
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
