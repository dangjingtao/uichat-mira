import { describe, expect, it, vi } from "vitest";

const repositoryMock = vi.hoisted(() => ({
  createPairingChallenge: vi.fn((input: Record<string, unknown>) => ({
    id: String(input.id),
    userId: Number(input.userId),
    status: "pending" as const,
    codeHash: String(input.codeHash),
    hostUrl: String(input.hostUrl),
    createdAt: String(input.createdAt),
    expiresAt: String(input.expiresAt),
    claimId: null,
    claimTokenHash: null,
    deviceName: null,
    platform: null,
    publicKey: null,
    requestedScopes: [],
    approvedScopes: [],
    credentialEncrypted: null,
    deviceId: null,
    attempts: 0,
    claimedAt: null,
    resolvedAt: null,
    deliveredAt: null,
  })),
}));

vi.mock("@/db/repositories/tailscale-remote-access.repository.js", () => ({
  REMOTE_DEVICE_SCOPES: ["threads:read"],
  tailscaleRemoteAccessRepository: repositoryMock,
}));

import { RemoteAccessPairingService } from "./remote-access-pairing.service.js";

const clientToken = "c".repeat(43);

describe("Remote pairing Relay metadata", () => {
  it("adds Relay metadata without changing the V1 Direct pairing fields", () => {
    const service = new RemoteAccessPairingService();
    const created = service.createChallenge({
      userId: 7,
      hostUrl: "https://desktop.example.ts.net/",
      relay: {
        endpoint: "https://relay.tomz.io",
        relayId: "relay_1234567890abcdef",
        clientToken,
      },
    });

    const uri = new URL(created.pairingUri);
    expect(uri.protocol).toBe("mira:");
    expect(uri.host).toBe("pair");
    expect(uri.searchParams.get("version")).toBe("1");
    expect(uri.searchParams.get("host")).toBe(
      "https://desktop.example.ts.net",
    );
    expect(uri.searchParams.get("challenge")).toBe(created.challengeId);
    expect(uri.searchParams.get("code")).toBe(created.code);
    expect(uri.searchParams.get("relay")).toBe("https://relay.tomz.io");
    expect(uri.searchParams.get("relayId")).toBe("relay_1234567890abcdef");
    expect(uri.searchParams.get("relayToken")).toBe(clientToken);
  });

  it("allows a Relay-only pairing URI without inventing a Direct host", () => {
    const service = new RemoteAccessPairingService();
    const created = service.createChallenge({
      userId: 7,
      hostUrl: null,
      relay: {
        endpoint: "https://relay.tomz.io",
        relayId: "relay_1234567890abcdef",
        clientToken,
      },
    });

    const uri = new URL(created.pairingUri);
    expect(created.hostUrl).toBe("");
    expect(uri.searchParams.has("host")).toBe(false);
    expect(uri.searchParams.get("relay")).toBe("https://relay.tomz.io");
    expect(uri.searchParams.get("relayToken")).toBe(clientToken);
  });
});
