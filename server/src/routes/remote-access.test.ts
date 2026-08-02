import assert from "node:assert/strict";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendRouteError } from "@/utils/route-errors.js";

const mocks = vi.hoisted(() => {
  class PairingServiceError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
      this.name = "PairingServiceError";
    }
  }

  return {
    PairingServiceError,
    pairing: {
      createChallenge: vi.fn(),
      getChallengeForUser: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
      claim: vi.fn(),
      poll: vi.fn(),
    },
    tailscale: {
      getSnapshot: vi.fn(),
    },
  };
});

vi.mock("@/services/remote-access-pairing.service.js", () => ({
  PairingServiceError: mocks.PairingServiceError,
  remoteAccessPairingService: mocks.pairing,
}));

vi.mock("@/services/tailscale-remote-access.service.js", () => ({
  tailscaleRemoteAccessService: mocks.tailscale,
}));

vi.mock("@/db/repositories/tailscale-remote-access.repository.js", () => ({
  REMOTE_DEVICE_SCOPES: [
    "threads:read",
    "messages:read",
    "messages:write",
    "agent:read",
    "agent:approve",
    "agent:control",
    "artifacts:read",
  ],
}));

import remoteAccessRoute from "./remote-access.js";

const user = { id: 7, username: "tester", role: "user" as const };
const readySnapshot = {
  runtime: {
    state: "ready",
    accessUrl: "https://mira.example.ts.net",
  },
};

const createApp = async (options: { authenticated?: boolean; device?: unknown } = {}) => {
  const app = Fastify();
  app.setErrorHandler(sendRouteError);
  await app.addHook("preHandler", async (request) => {
    if (options.authenticated) {
      request.authUser = user;
    }
    if (options.device) {
      request.remoteDevice = options.device as never;
    }
  });
  await app.register(remoteAccessRoute);
  return app;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tailscale.getSnapshot.mockResolvedValue(readySnapshot);
  mocks.pairing.createChallenge.mockReturnValue({
    challengeId: "challenge-1",
    status: "pending",
    hostUrl: "https://mira.example.ts.net",
    code: "ABCD2345",
  });
  mocks.pairing.getChallengeForUser.mockReturnValue({
    challengeId: "challenge-1",
    status: "claimed",
  });
  mocks.pairing.approve.mockReturnValue({
    challengeId: "challenge-1",
    status: "approved",
    approvedScopes: ["threads:read"],
  });
  mocks.pairing.reject.mockReturnValue({
    challengeId: "challenge-1",
    status: "rejected",
  });
  mocks.pairing.claim.mockReturnValue({
    claimId: "claim-1",
    pollToken: "poll-token-123456789012345",
    status: "claimed",
  });
  mocks.pairing.poll.mockReturnValue({
    status: "approved",
    deviceId: "device-1",
    scopes: ["threads:read"],
    credential: "mira_device_credential",
  });
});

describe("remote access routes", () => {
  it("requires desktop authentication before creating a challenge", async () => {
    const app = await createApp();

    const response = await app.inject({
      method: "POST",
      url: "/remote/admin/pairing/challenges",
    });

    assert.equal(response.statusCode, 403, response.body);
    expect(mocks.tailscale.getSnapshot).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects challenge creation when Tailscale remote access is not ready", async () => {
    mocks.tailscale.getSnapshot.mockResolvedValueOnce({
      runtime: { state: "connected", accessUrl: null },
    });
    const app = await createApp({ authenticated: true });

    const response = await app.inject({
      method: "POST",
      url: "/remote/admin/pairing/challenges",
    });

    assert.equal(response.statusCode, 400, response.body);
    expect(mocks.pairing.createChallenge).not.toHaveBeenCalled();
    await app.close();
  });

  it("creates an admin challenge from the ready Tailscale access URL", async () => {
    const app = await createApp({ authenticated: true });

    const response = await app.inject({
      method: "POST",
      url: "/remote/admin/pairing/challenges",
    });

    assert.equal(response.statusCode, 200, response.body);
    expect(mocks.tailscale.getSnapshot).toHaveBeenCalledWith({ verifyHealth: true });
    expect(mocks.pairing.createChallenge).toHaveBeenCalledWith({
      userId: user.id,
      hostUrl: "https://mira.example.ts.net",
    });
    assert.equal(response.json().data.challengeId, "challenge-1");
    await app.close();
  });

  it("forwards desktop approval and rejection with the authenticated user", async () => {
    const app = await createApp({ authenticated: true });

    const approveResponse = await app.inject({
      method: "POST",
      url: "/remote/admin/pairing/claims/claim-1/approve",
      payload: { scopes: ["threads:read", "messages:read"] },
    });
    const rejectResponse = await app.inject({
      method: "POST",
      url: "/remote/admin/pairing/claims/claim-1/reject",
    });

    assert.equal(approveResponse.statusCode, 200, approveResponse.body);
    assert.equal(rejectResponse.statusCode, 200, rejectResponse.body);
    expect(mocks.pairing.approve).toHaveBeenCalledWith({
      claimId: "claim-1",
      userId: user.id,
      scopes: ["threads:read", "messages:read"],
    });
    expect(mocks.pairing.reject).toHaveBeenCalledWith({
      claimId: "claim-1",
      userId: user.id,
    });
    await app.close();
  });

  it("forwards mobile claim and poll requests without desktop authentication", async () => {
    const app = await createApp();

    const claimResponse = await app.inject({
      method: "POST",
      url: "/remote/pairing/claim",
      payload: {
        challengeId: "challenge-1",
        code: "ABCD2345",
        deviceName: "K70",
        platform: "android",
        requestedScopes: ["threads:read"],
      },
    });
    const pollResponse = await app.inject({
      method: "POST",
      url: "/remote/pairing/claims/claim-1/poll",
      payload: { pollToken: "poll-token-123456789012345" },
    });

    assert.equal(claimResponse.statusCode, 200, claimResponse.body);
    assert.equal(pollResponse.statusCode, 200, pollResponse.body);
    expect(mocks.pairing.claim).toHaveBeenCalledWith({
      challengeId: "challenge-1",
      code: "ABCD2345",
      deviceName: "K70",
      platform: "android",
      requestedScopes: ["threads:read"],
    });
    expect(mocks.pairing.poll).toHaveBeenCalledWith(
      "claim-1",
      "poll-token-123456789012345",
    );
    await app.close();
  });

  it("maps pairing-not-found errors to 404", async () => {
    mocks.pairing.getChallengeForUser.mockImplementationOnce(() => {
      throw new mocks.PairingServiceError(
        "PAIRING_NOT_FOUND",
        "Pairing challenge not found",
      );
    });
    const app = await createApp({ authenticated: true });

    const response = await app.inject({
      method: "GET",
      url: "/remote/admin/pairing/challenges/missing",
    });

    assert.equal(response.statusCode, 404, response.body);
    assert.equal(response.json().message, "Pairing challenge not found");
    await app.close();
  });

  it("requires a paired device credential for the remote manifest", async () => {
    const app = await createApp();

    const forbiddenResponse = await app.inject({
      method: "GET",
      url: "/remote/v1/manifest",
    });
    assert.equal(forbiddenResponse.statusCode, 403, forbiddenResponse.body);

    const manifestApp = await createApp({
      device: {
        id: "device-1",
        name: "K70",
        platform: "android",
        permissions: ["threads:read"],
      },
    });
    const manifestResponse = await manifestApp.inject({
      method: "GET",
      url: "/remote/v1/manifest",
    });

    assert.equal(manifestResponse.statusCode, 200, manifestResponse.body);
    assert.equal(manifestResponse.json().data.device.id, "device-1");
    await app.close();
    await manifestApp.close();
  });
});
