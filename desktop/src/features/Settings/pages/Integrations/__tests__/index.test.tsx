// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import IntegrationsSettings from "../index";

const apiMocks = vi.hoisted(() => ({
  getIntegrationCapabilityMicroAppBinding: vi.fn(),
  getIntegrationCapabilityStatus: vi.fn(),
  getIntegrationInstances: vi.fn(),
  getIntegrationMicroApps: vi.fn(),
  sendWecomRobotCapabilityTestMessage: vi.fn(),
  startIntegrationCapability: vi.fn(),
  stopIntegrationCapability: vi.fn(),
  updateIntegrationCapability: vi.fn(),
  updateIntegrationCapabilityMicroAppBinding: vi.fn(),
  updateIntegrationInstance: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/shared/api/knowledgeBase", () => ({
  listKnowledgeBases: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@/shared/api/integrations", () => ({
  getIntegrationCapabilityMicroAppBinding:
    apiMocks.getIntegrationCapabilityMicroAppBinding,
  getIntegrationCapabilityStatus: apiMocks.getIntegrationCapabilityStatus,
  getIntegrationInstances: apiMocks.getIntegrationInstances,
  getIntegrationMicroApps: apiMocks.getIntegrationMicroApps,
  sendWecomRobotCapabilityTestMessage:
    apiMocks.sendWecomRobotCapabilityTestMessage,
  startIntegrationCapability: apiMocks.startIntegrationCapability,
  stopIntegrationCapability: apiMocks.stopIntegrationCapability,
  updateIntegrationCapability: apiMocks.updateIntegrationCapability,
  updateIntegrationCapabilityMicroAppBinding:
    apiMocks.updateIntegrationCapabilityMicroAppBinding,
  updateIntegrationInstance: apiMocks.updateIntegrationInstance,
}));

describe("IntegrationsSettings", () => {
  beforeEach(() => {
    apiMocks.getIntegrationInstances.mockReturnValue(new Promise(() => {}));
    apiMocks.getIntegrationMicroApps.mockReturnValue(new Promise(() => {}));
  });

  it("shows a body-level loading skeleton instead of the empty-state alert on first entry", () => {
    render(<IntegrationsSettings />);

    expect(screen.getByTestId("integrations-loading-skeleton")).toBeInTheDocument();
    expect(
      screen.queryByText("settings.integrations.empty.title"),
    ).not.toBeInTheDocument();
  });
});
