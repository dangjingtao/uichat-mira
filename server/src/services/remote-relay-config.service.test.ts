import { beforeEach, describe, expect, it, vi } from "vitest";

const configMock = vi.hoisted(() => ({
  REMOTE_RELAY_DEFAULT_URL: "https://mira-relay.example.workers.dev",
}));

const repositoryMock = vi.hoisted(() => ({
  get: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/config/index.js", () => ({ default: configMock }));
vi.mock("@/db/repositories/remote-relay-settings.repository.js", () => ({
  remoteRelaySettingsRepository: repositoryMock,
}));

import {
  RemoteRelayConfigError,
  getRemoteRelayPairingMetadata,
  getRemoteRelayUserConfig,
  resolvePersistedRemoteRelayConnectorConfig,
  updateRemoteRelayUserConfig,
} from "./remote-relay-config.service.js";

const baseSettings = {
  enabled: true,
  endpointMode: "default" as const,
  customUrl: "",
  relayId: "relay_1234567890abcdef",
  hostToken: "h".repeat(48),
  clientToken: "c".repeat(48),
  updatedAt: "2026-08-09T10:00:00.000Z",
};

beforeEach(() => {
  repositoryMock.get.mockReset();
  repositoryMock.update.mockReset();
  configMock.REMOTE_RELAY_DEFAULT_URL =
    "https://mira-relay.example.workers.dev";
  repositoryMock.get.mockReturnValue(baseSettings);
  repositoryMock.update.mockImplementation((input) => ({
    ...baseSettings,
    ...input,
  }));
});

describe("Mira Relay product configuration", () => {
  it("uses the build-provided default endpoint without exposing identity", () => {
    expect(getRemoteRelayUserConfig()).toEqual({
      enabled: true,
      endpointMode: "default",
      customUrl: "",
      effectiveUrl: "https://mira-relay.example.workers.dev",
      defaultAvailable: true,
      updatedAt: "2026-08-09T10:00:00.000Z",
    });
  });

  it("converts the selected HTTPS endpoint to WSS for the connector", () => {
    expect(resolvePersistedRemoteRelayConnectorConfig()).toEqual({
      enabled: true,
      relayUrl: "wss://mira-relay.example.workers.dev",
      relayId: "relay_1234567890abcdef",
      hostToken: "h".repeat(48),
      clientToken: "c".repeat(48),
    });
  });

  it("accepts and persists a custom Relay base URL", () => {
    repositoryMock.get
      .mockReturnValueOnce(baseSettings)
      .mockReturnValueOnce({
        ...baseSettings,
        endpointMode: "custom",
        customUrl: "https://relay.tomz.io",
      });

    const result = updateRemoteRelayUserConfig({
      endpointMode: "custom",
      customUrl: "https://relay.tomz.io/",
    });

    expect(repositoryMock.update).toHaveBeenCalledWith({
      enabled: true,
      endpointMode: "custom",
      customUrl: "https://relay.tomz.io/",
    });
    expect(result.effectiveUrl).toBe("https://relay.tomz.io");
  });

  it("rejects insecure or path-scoped custom Relay URLs", () => {
    expect(() =>
      updateRemoteRelayUserConfig({
        endpointMode: "custom",
        customUrl: "http://relay.example.com",
      }),
    ).toThrow(RemoteRelayConfigError);

    expect(() =>
      updateRemoteRelayUserConfig({
        endpointMode: "custom",
        customUrl: "https://relay.example.com/mira",
      }),
    ).toThrow(RemoteRelayConfigError);
  });

  it("only emits pairing metadata while Relay is enabled and resolvable", () => {
    expect(getRemoteRelayPairingMetadata()).toEqual({
      endpoint: "https://mira-relay.example.workers.dev",
      relayId: "relay_1234567890abcdef",
      clientToken: "c".repeat(48),
    });

    repositoryMock.get.mockReturnValue({ ...baseSettings, enabled: false });
    expect(getRemoteRelayPairingMetadata()).toBeNull();
  });
});
