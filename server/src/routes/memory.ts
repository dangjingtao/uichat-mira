import type { FastifyPluginAsync } from "fastify";
import { requireAuth } from "@/db/auth.db.js";
import { memoryService } from "@/memory/runtime.js";
import type { MemoryKind } from "@/memory/types.js";
import {
  errorEnvelope,
  idParamsSchema,
  successEnvelope,
} from "@/routes/schema-helpers.js";
import { success } from "@/utils/index.js";
import { notFound, routeHandler } from "@/utils/route-errors.js";

const MEMORY_KIND_VALUES: MemoryKind[] = [
  "preference",
  "fact",
  "decision",
  "constraint",
];

const memoryRecordSchema = {
  type: "object",
  required: ["id", "kind", "content", "origin", "createdAt", "updatedAt"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: MEMORY_KIND_VALUES },
    content: { type: "string" },
    origin: { type: "string", enum: ["conversation", "manual"] },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const memoryOverviewSchema = {
  type: "object",
  required: ["enabled", "records"],
  additionalProperties: false,
  properties: {
    enabled: { type: "boolean" },
    records: {
      type: "array",
      items: memoryRecordSchema,
    },
  },
} as const;

const memoryMutationBodySchema = {
  type: "object",
  required: ["kind", "content"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: MEMORY_KIND_VALUES },
    content: { type: "string", minLength: 4, maxLength: 500 },
  },
} as const;

const memoryRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/memory",
    {
      schema: {
        tags: ["Memory"],
        summary: "Get user memory overview",
        operationId: "getMemoryOverview",
        response: {
          200: successEnvelope(memoryOverviewSchema),
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to get memory overview", async (request) =>
      success(await memoryService.getOverview(request.authUser!.id))),
  );

  app.put<{ Body: { enabled: boolean } }>(
    "/memory/settings",
    {
      schema: {
        tags: ["Memory"],
        summary: "Update user memory settings",
        operationId: "updateMemorySettings",
        body: {
          type: "object",
          required: ["enabled"],
          additionalProperties: false,
          properties: {
            enabled: { type: "boolean" },
          },
        },
        response: {
          200: successEnvelope(memoryOverviewSchema),
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to update memory settings", async (request) =>
      success(
        await memoryService.setEnabled(
          request.authUser!.id,
          request.body.enabled,
        ),
        "Memory settings updated",
      )),
  );

  app.post<{ Body: { kind: MemoryKind; content: string } }>(
    "/memory",
    {
      schema: {
        tags: ["Memory"],
        summary: "Create a manual memory",
        operationId: "createManualMemory",
        body: memoryMutationBodySchema,
        response: {
          200: successEnvelope(memoryOverviewSchema),
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to create memory", async (request) =>
      success(
        await memoryService.createManual(request.authUser!.id, request.body),
        "Memory created",
      )),
  );

  app.patch<{
    Params: { id: string };
    Body: { kind: MemoryKind; content: string };
  }>(
    "/memory/:id",
    {
      schema: {
        tags: ["Memory"],
        summary: "Update a memory",
        operationId: "updateManualMemory",
        params: idParamsSchema,
        body: memoryMutationBodySchema,
        response: {
          200: successEnvelope(memoryOverviewSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to update memory", async (request) => {
      const overview = await memoryService.updateManual(
        request.authUser!.id,
        request.params.id,
        request.body,
      );
      if (!overview) throw notFound("Memory not found");
      return success(overview, "Memory updated");
    }),
  );

  app.delete<{ Params: { id: string } }>(
    "/memory/:id",
    {
      schema: {
        tags: ["Memory"],
        summary: "Delete a memory",
        operationId: "deleteManualMemory",
        params: idParamsSchema,
        response: {
          200: successEnvelope(memoryOverviewSchema),
          404: errorEnvelope,
          500: errorEnvelope,
        },
      },
    },
    routeHandler("Failed to delete memory", async (request) => {
      const overview = await memoryService.deleteManual(
        request.authUser!.id,
        request.params.id,
      );
      if (!overview) throw notFound("Memory not found");
      return success(overview, "Memory deleted");
    }),
  );
};

export default memoryRoute;
