// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MicroAppDetailPage from "../Detail";

const apiMocks = vi.hoisted(() => ({
  getIntegrationCapabilityMicroAppBinding: vi.fn(),
  getIntegrationCapabilityStatus: vi.fn(),
  getIntegrationInstances: vi.fn(),
  getIntegrationMicroApps: vi.fn(),
  updateIntegrationCapabilityMicroAppBinding: vi.fn(),
  updateIntegrationMicroApp: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/shared/api/integrations", () => ({
  getIntegrationCapabilityMicroAppBinding:
    apiMocks.getIntegrationCapabilityMicroAppBinding,
  getIntegrationCapabilityStatus: apiMocks.getIntegrationCapabilityStatus,
  getIntegrationInstances: apiMocks.getIntegrationInstances,
  getIntegrationMicroApps: apiMocks.getIntegrationMicroApps,
  updateIntegrationCapabilityMicroAppBinding:
    apiMocks.updateIntegrationCapabilityMicroAppBinding,
  updateIntegrationMicroApp: apiMocks.updateIntegrationMicroApp,
}));

describe("MicroAppDetailPage", () => {
  beforeEach(() => {
    apiMocks.getIntegrationMicroApps.mockResolvedValue({
      microApps: [
        {
          id: "knowledge-query",
          name: "Knowledge Query",
          type: "knowledge_query",
          enabled: true,
          supportedAccessPoints: ["wecom.smart_robot"],
          bindingSchema: {
            fields: [],
          },
        },
      ],
    });
    apiMocks.getIntegrationInstances.mockResolvedValue({
      instances: [],
    });
    apiMocks.getIntegrationCapabilityMicroAppBinding.mockReset();
    apiMocks.getIntegrationCapabilityStatus.mockReset();
  });

  it("keeps the enterprise micro app detail page focused on its own config and does not inject the studio entry", async () => {
    render(
      <MemoryRouter initialEntries={["/settings/micro-apps/knowledge-query"]}>
        <Routes>
          <Route
            path="/settings/micro-apps/:appId"
            element={<MicroAppDetailPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Knowledge Query")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", {
        name: /settings\.microApps\.studioEntries\.computerUse\.actions\.open/,
      }),
    ).not.toBeInTheDocument();
  });
});
