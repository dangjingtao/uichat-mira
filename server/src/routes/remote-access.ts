import type { FastifyPluginAsync } from "fastify";
import {
  PairingServiceError,
  remoteAccessPairingService,
} from "@/services/remote-access-pairing.service.js";
import { tailscaleRemoteAccessService } from "@/services/tailscale-remote-access.service.js";
import { successEnvelope, errorEnvelope } from "@/routes/schema-helpers.js";
import { success } from "@/utils/index.js";
import {
  badRequest,
  forbidden,
  notFound,
  routeHandler,
} from "@/utils/route-errors.js";
import { REMOTE_DEVICE_SCOPES } from "@/db/repositories/tailscale-remote-access.repository.js";

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const mapPairingError = (error: unknown): never => {
  if (error instanceof PairingServiceError) {
    if (error.code === "PAIRING_NOT_FOUND") {
      throw notFound(error.message, { cause: error });
    }
    throw badRequest(error.message, { cause: error });
  }
  throw error;
};

const remoteAccessRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/remote/admin/pairing/challenges",
    {
      schema: {
        tags: ["Remote Access"],
        summary: "Create a one-time mobile pairing challenge",
        operationId: "createRemotePairingChallenge",
        response: {
          200: successEnvelope(looseObjectSchema),
          400: errorEnvelope,
          401: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to create remote pairing challenge", async (request) => {
      const user = request.authUser;
      if (!user) {
        throw forbidden("Desktop authentication is required");
      }

      const snapshot = await tailscaleRemoteAccessService.getSnapshot({
        verifyHealth: true,
      });
      if (snapshot.runtime.state !== "ready" || !snapshot.runtime.accessUrl) {
        throw badRequest(
          "Tailscale remote access must be ready before pairing a mobile device",
        );
      }

      return success(
        remoteAccessPairingService.createChallenge({
          userId: user.id,
          hostUrl: snapshot.runtime.accessUrl,
        }),
        "Pairing challenge created",
      );
    }),
  );

  app.get<{ Params: { challengeId: string } }>(
    "/remote/admin/pairing/challenges/:challengeId",
    {
      schema: {
        tags: ["Remote Access"],
        summary: "Get a pairing challenge for desktop confirmation",
        operationId: "getRemotePairingChallenge",
        params: {
          type: "object",
          required: ["challengeId"],
          properties: { challengeId: { type: "string", minLength: 1 } },
        },
        response: {
          200: successEnvelope(looseObjectSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to get remote pairing challenge", async (request) => {
      const user = request.authUser;
      if (!user) {
        throw forbidden("Desktop authentication is required");
      }
      try {
        return success(
          remoteAccessPairingService.getChallengeForUser(
            request.params.challengeId,
            user.id,
          ),
        );
      } catch (error) {
        return mapPairingError(error);
      }
    }),
  );

  app.post<{
    Params: { claimId: string };
    Body: { scopes?: string[] };
  }>(
    "/remote/admin/pairing/claims/:claimId/approve",
    {
      schema: {
        tags: ["Remote Access"],
        summary: "Approve a claimed mobile device",
        operationId: "approveRemotePairingClaim",
        params: {
          type: "object",
          required: ["claimId"],
          properties: { claimId: { type: "string", minLength: 1 } },
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            scopes: {
              type: "array",
              uniqueItems: true,
              items: { type: "string", enum: [...REMOTE_DEVICE_SCOPES] },
            },
          },
        },
        response: {
          200: successEnvelope(looseObjectSchema),
          400: errorEnvelope,
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to approve remote pairing claim", async (request) => {
      const user = request.authUser;
      if (!user) {
        throw forbidden("Desktop authentication is required");
      }
      try {
        return success(
          remoteAccessPairingService.approve({
            claimId: request.params.claimId,
            userId: user.id,
            scopes: request.body.scopes,
          }),
          "Remote device approved",
        );
      } catch (error) {
        return mapPairingError(error);
      }
    }),
  );

  app.post<{ Params: { claimId: string } }>(
    "/remote/admin/pairing/claims/:claimId/reject",
    {
      schema: {
        tags: ["Remote Access"],
        summary: "Reject a claimed mobile device",
        operationId: "rejectRemotePairingClaim",
        params: {
          type: "object",
          required: ["claimId"],
          properties: { claimId: { type: "string", minLength: 1 } },
        },
        response: {
          200: successEnvelope(looseObjectSchema),
          400: errorEnvelope,
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to reject remote pairing claim", async (request) => {
      const user = request.authUser;
      if (!user) {
        throw forbidden("Desktop authentication is required");
      }
      try {
        return success(
          remoteAccessPairingService.reject({
            claimId: request.params.claimId,
            userId: user.id,
          }),
          "Remote device rejected",
        );
      } catch (error) {
        return mapPairingError(error);
      }
    }),
  );

  app.post<{
    Body: {
      challengeId: string;
      code: string;
      deviceName?: string;
      platform?: string;
      publicKey?: string;
      requestedScopes?: string[];
    };
  }>(
    "/remote/pairing/claim",
    {
      schema: {
        tags: ["Remote Pairing"],
        summary: "Claim a one-time pairing challenge from mobile",
        operationId: "claimRemotePairingChallenge",
        body: {
          type: "object",
          additionalProperties: false,
          required: ["challengeId", "code"],
          properties: {
            challengeId: { type: "string", minLength: 1 },
            code: { type: "string", minLength: 8, maxLength: 16 },
            deviceName: { type: "string", maxLength: 80 },
            platform: { type: "string", maxLength: 40 },
            publicKey: { type: "string", maxLength: 4096 },
            requestedScopes: {
              type: "array",
              uniqueItems: true,
              items: { type: "string", enum: [...REMOTE_DEVICE_SCOPES] },
            },
          },
        },
        response: {
          200: successEnvelope(looseObjectSchema),
          400: errorEnvelope,
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to claim remote pairing challenge", async (request) => {
      try {
        return success(
          remoteAccessPairingService.claim(request.body),
          "Pairing challenge claimed",
        );
      } catch (error) {
        return mapPairingError(error);
      }
    }),
  );

  app.post<{
    Params: { claimId: string };
    Body: { pollToken: string };
  }>(
    "/remote/pairing/claims/:claimId/poll",
    {
      schema: {
        tags: ["Remote Pairing"],
        summary: "Poll pairing approval and retrieve the credential once",
        operationId: "pollRemotePairingClaim",
        params: {
          type: "object",
          required: ["claimId"],
          properties: { claimId: { type: "string", minLength: 1 } },
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["pollToken"],
          properties: { pollToken: { type: "string", minLength: 20 } },
        },
        response: {
          200: successEnvelope(looseObjectSchema),
          400: errorEnvelope,
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to poll remote pairing claim", async (request) => {
      try {
        return success(
          remoteAccessPairingService.poll(
            request.params.claimId,
            request.body.pollToken,
          ),
        );
      } catch (error) {
        return mapPairingError(error);
      }
    }),
  );

  app.get(
    "/remote/v1/manifest",
    {
      schema: {
        tags: ["Remote Access"],
        summary: "Get the scoped remote-device protocol manifest",
        operationId: "getRemoteDeviceManifest",
        response: {
          200: successEnvelope(looseObjectSchema),
          401: errorEnvelope,
          403: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to get remote device manifest", async (request) => {
      const device = request.remoteDevice;
      if (!device) {
        throw forbidden("A paired remote device credential is required");
      }

      return success({
        protocolVersion: 1,
        device: {
          id: device.id,
          name: device.name,
          platform: device.platform,
          scopes: device.permissions,
        },
        routes: {
          threads: ["GET /threads", "GET /threads/:id"],
          messages: ["GET /threads/:id/messages", "POST /proxy/chat/default"],
          agent: [
            "GET /agent/runs/:runId",
            "POST /agent/runs/:runId/approve",
            "POST /agent/runs/:runId/reject",
            "POST /agent/runs/:runId/cancel",
          ],
          artifacts: ["GET /threads/:id/media/:mediaId/content"],
        },
        reconnect: {
          mode: "canonical-state-replay",
          eventCursor: false,
        },
        serverTime: new Date().toISOString(),
      });
    }),
  );
};

export default remoteAccessRoute;
