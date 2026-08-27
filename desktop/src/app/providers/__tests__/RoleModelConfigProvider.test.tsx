// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  broadcastRoleModelConfigChanged,
  RoleModelConfigProvider,
  useRoleModelConfigs,
} from "../RoleModelConfigProvider";

const authState = vi.hoisted(() => ({
  token: null as string | null,
}));
const getRoleModelConfigs = vi.hoisted(() => vi.fn());

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    session: authState.token ? { token: authState.token } : null,
  }),
}));

vi.mock("@/shared/api/modelSettings", () => ({
  getRoleModelConfigs,
}));

const llmConfig = {
  id: "config-llm",
  type: "llm" as const,
  name: "Default chat",
  providerCode: "openai",
  providerConnectionId: "openai-default",
  providerConnectionDisplayName: "OpenAI",
  providerTemplateCode: "openai",
  remoteModelId: "gpt-4o-mini",
  params: {},
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function Probe() {
  const state = useRoleModelConfigs();
  return (
    <div>
      <span data-testid="loaded">{String(state.loaded)}</span>
      <span data-testid="loading">{String(state.loading)}</span>
      <span data-testid="count">{state.configs.length}</span>
      <span data-testid="llm">{state.configMap.llm?.remoteModelId ?? "none"}</span>
      <span data-testid="has-llm">{String(state.hasDefaultLlm)}</span>
      <span data-testid="has-embedding">{String(state.hasDefaultEmbedding)}</span>
      <span data-testid="llm-connected">
        {String(state.modelAccessStatus.llmConnected)}
      </span>
    </div>
  );
}

describe("RoleModelConfigProvider", () => {
  beforeEach(() => {
    authState.token = null;
    getRoleModelConfigs.mockReset();
  });

  it("stays disconnected and does not fetch without a session", () => {
    render(
      <RoleModelConfigProvider>
        <Probe />
      </RoleModelConfigProvider>,
    );

    expect(screen.getByTestId("loaded")).toHaveTextContent("false");
    expect(screen.getByTestId("count")).toHaveTextContent("0");
    expect(screen.getByTestId("llm-connected")).toHaveTextContent("false");
    expect(getRoleModelConfigs).not.toHaveBeenCalled();
  });

  it("loads role assignments and derives default model access", async () => {
    authState.token = "token";
    getRoleModelConfigs.mockResolvedValue([llmConfig]);

    render(
      <RoleModelConfigProvider>
        <Probe />
      </RoleModelConfigProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loaded")).toHaveTextContent("true"),
    );
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("llm")).toHaveTextContent("gpt-4o-mini");
    expect(screen.getByTestId("has-llm")).toHaveTextContent("true");
    expect(screen.getByTestId("has-embedding")).toHaveTextContent("false");
    expect(screen.getByTestId("llm-connected")).toHaveTextContent("true");
  });

  it("refreshes cached assignments after the shared change event", async () => {
    authState.token = "token";
    getRoleModelConfigs
      .mockResolvedValueOnce([llmConfig])
      .mockResolvedValueOnce([
        { ...llmConfig, remoteModelId: "gpt-5-mini", name: "Updated chat" },
      ]);

    render(
      <RoleModelConfigProvider>
        <Probe />
      </RoleModelConfigProvider>,
    );
    await screen.findByText("gpt-4o-mini");

    act(() => {
      broadcastRoleModelConfigChanged();
    });

    await screen.findByText("gpt-5-mini");
    expect(getRoleModelConfigs).toHaveBeenCalledTimes(2);
  });

  it("requires consumers to be inside the provider", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(
      "useRoleModelConfigs must be used within RoleModelConfigProvider",
    );
    errorSpy.mockRestore();
  });
});
