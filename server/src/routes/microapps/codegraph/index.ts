import type { FastifyPluginAsync } from "fastify";
import { successEnvelope } from "@/routes/schema-helpers.js";
import { success } from "@/utils/index.js";
import { routeHandler } from "@/utils/route-errors.js";
import type { CodeGraphStudioService } from "@/microapps/codegraph/index.js";
import { normalizeCodeGraphStudioReport } from "@/microapps/codegraph/public-report.js";

const stringArraySchema = {
  type: "array",
  items: { type: "string" },
} as const;

const reportSchema = {
  type: "object",
  required: ["status", "blockedReasons", "config", "capability", "pollutionGuard", "runtime", "debug"],
  properties: {
    status: {
      type: "string",
      enum: ["ready", "blocked", "unavailable", "degraded", "stopped"],
    },
    blockedReasons: {
      type: "array",
      items: {
        type: "object",
        required: ["code", "label", "message"],
        properties: {
          code: { type: "string" },
          label: { type: "string" },
          message: { type: "string" },
        },
      },
    },
    config: {
      type: "object",
      required: [
        "workspaceRoot",
        "appDataRoot",
        "appDataRootResolved",
        "logRoot",
        "indexRoot",
        "command",
        "startArgs",
        "versionProbeArgs",
        "telemetryProbeArgs",
        "timeoutMs",
        "maxResults",
        "queryLimit",
        "microAppEnabled",
        "agentCapabilityEnabled",
        "capabilityRegistered",
      ],
      properties: {
        workspaceRoot: { type: "string" },
        appDataRoot: { type: "string" },
        appDataRootResolved: { type: ["string", "null"] },
        logRoot: { type: ["string", "null"] },
        indexRoot: { type: ["string", "null"] },
        command: { type: "string" },
        startArgs: stringArraySchema,
        versionProbeArgs: stringArraySchema,
        telemetryProbeArgs: stringArraySchema,
        timeoutMs: { type: "integer" },
        maxResults: { type: "integer" },
        queryLimit: { type: "integer" },
        microAppEnabled: { type: "boolean" },
        agentCapabilityEnabled: { type: "boolean" },
        capabilityRegistered: { type: "boolean" },
      },
    },
    capability: {
      type: "object",
      required: ["available", "registered", "reasons", "checks"],
      properties: {
        available: { type: "boolean" },
        registered: { type: "boolean" },
        reasons: {
          type: "array",
          items: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
          },
        },
        checks: {
          type: "object",
          required: [
            "microAppEnabled",
            "agentCapabilityEnabled",
            "runtimeReady",
            "telemetryVerifiedOff",
            "workspaceMatched",
            "repoPollutionSafe",
            "appDataRootValid",
            "capabilityRegistrationReady",
          ],
          properties: {
            microAppEnabled: { type: "boolean" },
            agentCapabilityEnabled: { type: "boolean" },
            runtimeReady: { type: "boolean" },
            telemetryVerifiedOff: { type: "boolean" },
            workspaceMatched: { type: "boolean" },
            repoPollutionSafe: { type: "boolean" },
            appDataRootValid: { type: "boolean" },
            capabilityRegistrationReady: { type: "boolean" },
          },
        },
      },
    },
    pollutionGuard: {
      type: "object",
      required: ["status", "repoDataDirName", "repoDataDirPath", "exists", "blockedReason"],
      properties: {
        status: { type: "string", enum: ["ready", "blocked"] },
        repoDataDirName: { type: "string" },
        repoDataDirPath: { type: "string" },
        exists: { type: "boolean" },
        blockedReason: { type: ["string", "null"] },
      },
    },
    runtime: {
      type: "object",
      required: [
        "providerVersion",
        "telemetryStatus",
        "handshakeStatus",
        "initializedNotificationSent",
        "processAlive",
        "startedAt",
        "stoppedAt",
        "durationMs",
        "exitCode",
        "lastStatus",
        "lastError",
        "crashCount",
        "startDisposition",
      ],
      properties: {
        providerVersion: { type: ["string", "null"] },
        telemetryStatus: { type: "string" },
        handshakeStatus: { type: "string" },
        initializedNotificationSent: { type: "boolean" },
        processAlive: { type: "boolean" },
        startedAt: { type: ["number", "null"] },
        stoppedAt: { type: ["number", "null"] },
        durationMs: { type: ["number", "null"] },
        exitCode: { type: ["number", "null"] },
        lastStatus: { type: ["string", "null"] },
        lastError: { type: ["string", "null"] },
        crashCount: { type: "integer" },
        startDisposition: { type: ["string", "null"] },
      },
    },
    debug: {
      type: "object",
      required: [
        "workspaceHash",
        "plannerStorage",
        "externalIndexSupport",
        "detectReasons",
        "rawManagerStatus",
      ],
      properties: {
        workspaceHash: { type: "string" },
        plannerStorage: {
          type: "object",
          additionalProperties: true,
        },
        externalIndexSupport: {
          type: "object",
          additionalProperties: true,
        },
        detectReasons: stringArraySchema,
        rawManagerStatus: { type: "string" },
      },
    },
  },
} as const;

const smokeSchema = {
  type: "object",
  required: ["kind", "ok", "message", "payload", "report"],
  properties: {
    kind: { type: "string", enum: ["status", "query"] },
    ok: { type: "boolean" },
    message: { type: "string" },
    payload: {},
    report: reportSchema,
  },
} as const;

const normalizeReportEnvelope = <T extends { report: Awaited<ReturnType<CodeGraphStudioService["getReport"]>> }>(
  result: T,
): T => ({
  ...result,
  report: normalizeCodeGraphStudioReport(result.report),
});

const codeGraphRoutes: FastifyPluginAsync<{
  codeGraphStudioService: CodeGraphStudioService;
}> = async (app, options) => {
  const { codeGraphStudioService } = options;
  if (!codeGraphStudioService) {
    throw new Error("codeGraphRoutes requires codeGraphStudioService");
  }

  app.get(
    "/microapps/codegraph/report",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get CodeGraph Studio report",
        security: [{ bearerAuth: [] }],
        response: {
          200: successEnvelope(reportSchema),
        },
      },
    },
    routeHandler("Failed to load CodeGraph Studio report", async () =>
      success(normalizeCodeGraphStudioReport(await codeGraphStudioService.getReport()))),
  );

  app.put<{
    Body: {
      command?: string;
      microAppEnabled?: boolean;
      agentCapabilityEnabled?: boolean;
      startArgs?: string[];
      versionProbeArgs?: string[];
      telemetryProbeArgs?: string[];
      appDataRoot?: string;
      timeoutMs?: number;
      maxResults?: number;
      queryLimit?: number;
    };
  }>(
    "/microapps/codegraph/config",
    {
      schema: {
        tags: ["Tools"],
        summary: "Save CodeGraph Studio config",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            command: { type: "string" },
            microAppEnabled: { type: "boolean" },
            agentCapabilityEnabled: { type: "boolean" },
            startArgs: stringArraySchema,
            versionProbeArgs: stringArraySchema,
            telemetryProbeArgs: stringArraySchema,
            appDataRoot: { type: "string" },
            timeoutMs: { type: "number" },
            maxResults: { type: "number" },
            queryLimit: { type: "number" },
          },
        },
        response: {
          200: successEnvelope(reportSchema),
        },
      },
    },
    routeHandler("Failed to save CodeGraph Studio config", async (request) => {
      await codeGraphStudioService.saveConfig(request.body);
      return success(
        normalizeCodeGraphStudioReport(await codeGraphStudioService.getReport()),
        "CodeGraph Studio config saved",
      );
    }),
  );

  app.post(
    "/microapps/codegraph/detect",
    {
      schema: {
        tags: ["Tools"],
        summary: "Run CodeGraph Studio detect",
        security: [{ bearerAuth: [] }],
        response: { 200: successEnvelope({ type: "object", required: ["report"], properties: { report: reportSchema } }) },
      },
    },
    routeHandler("Failed to detect CodeGraph Studio runtime", async () =>
      success(normalizeReportEnvelope(await codeGraphStudioService.detect()))),
  );

  app.post(
    "/microapps/codegraph/start",
    {
      schema: {
        tags: ["Tools"],
        summary: "Start CodeGraph Studio runtime",
        security: [{ bearerAuth: [] }],
        response: { 200: successEnvelope({ type: "object", required: ["report"], properties: { report: reportSchema } }) },
      },
    },
    routeHandler("Failed to start CodeGraph Studio runtime", async () =>
      success(normalizeReportEnvelope(await codeGraphStudioService.start()))),
  );

  app.post(
    "/microapps/codegraph/health",
    {
      schema: {
        tags: ["Tools"],
        summary: "Check CodeGraph Studio runtime health",
        security: [{ bearerAuth: [] }],
        response: { 200: successEnvelope({ type: "object", required: ["report"], properties: { report: reportSchema } }) },
      },
    },
    routeHandler("Failed to check CodeGraph Studio runtime health", async () =>
      success(normalizeReportEnvelope(await codeGraphStudioService.health()))),
  );

  app.post(
    "/microapps/codegraph/stop",
    {
      schema: {
        tags: ["Tools"],
        summary: "Stop CodeGraph Studio runtime",
        security: [{ bearerAuth: [] }],
        response: { 200: successEnvelope({ type: "object", required: ["report"], properties: { report: reportSchema } }) },
      },
    },
    routeHandler("Failed to stop CodeGraph Studio runtime", async () =>
      success(normalizeReportEnvelope(await codeGraphStudioService.stop()))),
  );

  app.post(
    "/microapps/codegraph/smoke/status",
    {
      schema: {
        tags: ["Tools"],
        summary: "Run CodeGraph Studio smoke status",
        security: [{ bearerAuth: [] }],
        response: { 200: successEnvelope(smokeSchema) },
      },
    },
    routeHandler("Failed to run CodeGraph Studio smoke status", async () =>
      success(normalizeReportEnvelope(await codeGraphStudioService.smokeStatus()))),
  );

  app.post<{ Body: { query: string } }>(
    "/microapps/codegraph/smoke/query",
    {
      schema: {
        tags: ["Tools"],
        summary: "Run CodeGraph Studio smoke query",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          additionalProperties: false,
          required: ["query"],
          properties: {
            query: { type: "string", minLength: 1 },
          },
        },
        response: { 200: successEnvelope(smokeSchema) },
      },
    },
    routeHandler("Failed to run CodeGraph Studio smoke query", async (request) =>
      success(normalizeReportEnvelope(await codeGraphStudioService.smokeQuery(request.body.query)))),
  );
};

export default codeGraphRoutes;
