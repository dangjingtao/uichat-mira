import type { FastifyPluginAsync } from "fastify";
import { Readable } from "node:stream";
import { success } from "@/utils/index.js";
import { routeHandler } from "@/utils/route-errors.js";
import { successEnvelope } from "@/routes/schema-helpers.js";
import { initializeHarnessRuntime } from "./bootstrap.js";
import {
  executeHarnessInvocation,
  getHarnessInvocation,
  getHarnessInvocationTrace,
  listHarnessInvocationEvents,
} from "./harness/invocations.js";
import {
  getReadableResourceImplementation,
  listCapabilityDefinitions,
  listReadableResourceDefinitions,
} from "./harness/registry.js";
import { getHarnessEnvironmentSnapshot } from "./harness/environment.js";
import { toSseChunk } from "./core/events.js";
import { mcpNotFound } from "./core/errors.js";
import { getWorkspaceSelection, selectWorkspaceRoot } from "./workspace.js";
import { fetchMcpMarketplaceServers } from "./marketplace.js";
import {
  connectExternalMcpServer,
  createExternalMcpServer,
  deleteExternalMcpServer,
  discoverExternalMcpServer,
  getExternalMcpServerConfig,
  getExternalMcpServerConfigSchema,
  listExternalMcpServers,
  updateExternalMcpServerConfig,
} from "./external.js";

const objectSchema = { type: "object", additionalProperties: true } as const;

const mcpRoutes: FastifyPluginAsync = async (app) => {
  initializeHarnessRuntime();

  app.get<{ Querystring: { cursor?: string; limit?: number; query?: string } }>(
    "/mcp/marketplace/servers",
    {
      schema: {
        tags: ["Tools"],
        summary: "List marketplace MCP servers",
        querystring: {
          type: "object",
          properties: {
            cursor: { type: "string" },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            query: { type: "string" },
          },
          additionalProperties: false,
        },
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to list marketplace MCP servers", async (request) =>
      success(
        await fetchMcpMarketplaceServers({
          cursor: request.query.cursor,
          limit: request.query.limit,
          query: request.query.query,
        }),
      )),
  );

  app.get(
    "/mcp/external/servers",
    {
      schema: {
        tags: ["Tools"],
        summary: "List configured external MCP servers",
        response: {
          200: successEnvelope({
            type: "array",
            items: objectSchema,
          }),
        },
      },
    },
    routeHandler("Failed to list external MCP servers", async () =>
      success(listExternalMcpServers())),
  );

  app.post<{
    Body: {
      id?: string;
      registryUrl?: string;
      packageName?: string;
      displayName: string;
      description?: string;
      version?: string;
      transport: {
        kind: "streamable-http";
        url: string;
      };
      disclaimerAccepted: boolean;
      disclaimerTextHash?: string;
    };
  }>(
    "/mcp/external/servers",
    {
      schema: {
        tags: ["Tools"],
        summary: "Create one external MCP server record",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to create external MCP server", async (request) =>
      success(
        createExternalMcpServer({
          id: request.body.id,
          registryUrl: request.body.registryUrl,
          packageName: request.body.packageName,
          displayName: request.body.displayName,
          description: request.body.description,
          version: request.body.version,
          transport: request.body.transport,
          disclaimerAccepted: request.body.disclaimerAccepted,
          disclaimerTextHash: request.body.disclaimerTextHash,
        }),
      )),
  );

  app.post<{ Params: { id: string } }>(
    "/mcp/external/servers/:id/connect",
    {
      schema: {
        tags: ["Tools"],
        summary: "Connect one external MCP server",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to connect external MCP server", async (request) =>
      success(await connectExternalMcpServer(request.params.id))),
  );

  app.post<{ Params: { id: string } }>(
    "/mcp/external/servers/:id/discover",
    {
      schema: {
        tags: ["Tools"],
        summary: "Discover capabilities from one external MCP server",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to discover external MCP server capabilities", async (request) =>
      success(await discoverExternalMcpServer(request.params.id))),
  );

  app.get<{ Params: { id: string } }>(
    "/mcp/external/servers/:id/config-schema",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get config schema draft for one external MCP server",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to get external MCP server config schema", async (request) =>
      success(getExternalMcpServerConfigSchema(request.params.id))),
  );

  app.get<{ Params: { id: string } }>(
    "/mcp/external/servers/:id/config",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get current config for one external MCP server",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to get external MCP server config", async (request) =>
      success(getExternalMcpServerConfig(request.params.id))),
  );

  app.patch<{
    Params: { id: string };
    Body: {
      endpointUrl: string;
      authType: "none" | "bearer";
      timeoutMs: number;
      customHeadersJson: string;
      bearerToken?: string | null;
    };
  }>(
    "/mcp/external/servers/:id/config",
    {
      schema: {
        tags: ["Tools"],
        summary: "Update config for one external MCP server",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to update external MCP server config", async (request) =>
      success(
        updateExternalMcpServerConfig(request.params.id, {
          endpointUrl: request.body.endpointUrl,
          authType: request.body.authType,
          timeoutMs: request.body.timeoutMs,
          customHeadersJson: request.body.customHeadersJson,
          bearerToken: request.body.bearerToken,
        }),
      )),
  );

  app.delete<{ Params: { id: string } }>(
    "/mcp/external/servers/:id",
    {
      schema: {
        tags: ["Tools"],
        summary: "Delete one external MCP server",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to delete external MCP server", async (request) =>
      success(deleteExternalMcpServer(request.params.id))),
  );

  app.get(
    "/mcp/workspace",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get active workspace root selection",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to get workspace selection", async () =>
      success(getWorkspaceSelection())),
  );

  app.post<{ Body: { rootPath: string } }>(
    "/mcp/workspace/select",
    {
      schema: {
        tags: ["Tools"],
        summary: "Select active workspace root",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to select workspace root", async (request) =>
      success(selectWorkspaceRoot(request.body.rootPath))),
  );

  app.get(
    "/mcp/tools",
    {
      schema: {
        tags: ["Tools"],
        summary: "List MCP tools",
        response: {
          200: successEnvelope({
            type: "array",
            items: objectSchema,
          }),
        },
      },
    },
    routeHandler("Failed to list MCP tools", async () => success(listCapabilityDefinitions())),
  );

  app.get(
    "/mcp/resources",
    {
      schema: {
        tags: ["Tools"],
        summary: "List MCP resources",
        response: {
          200: successEnvelope({
            type: "array",
            items: objectSchema,
          }),
        },
      },
    },
    routeHandler("Failed to list MCP resources", async () =>
      success(listReadableResourceDefinitions())),
  );

  app.post<{ Params: { id: string }; Body: Record<string, unknown> }>(
    "/mcp/resources/:id/read",
    {
      schema: {
        tags: ["Tools"],
        summary: "Read one MCP resource",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to read MCP resource", async (request) => {
      const resource = getReadableResourceImplementation(request.params.id);
      if (!resource?.read) {
        throw mcpNotFound(`Resource not found: ${request.params.id}`);
      }

      const result = await resource.read({
        args: request.body ?? {},
        environment: getHarnessEnvironmentSnapshot(),
      });
      return success(result);
    }),
  );

  app.post<{ Body: { toolId: string; args?: Record<string, unknown> } }>(
    "/mcp/invocations",
    {
      schema: {
        tags: ["Tools"],
        summary: "Execute one MCP tool invocation",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to execute MCP invocation", async (request) => {
      const result = await executeHarnessInvocation({
        toolId: request.body.toolId,
        args: request.body.args,
      });
      return success(result);
    }),
  );

  app.post<{ Body: { toolId: string; args?: Record<string, unknown> } }>(
    "/mcp/invocations/stream",
    {
      schema: {
        tags: ["Tools"],
        summary: "Execute one MCP tool invocation with SSE stream",
      },
    },
    routeHandler("Failed to stream MCP invocation", async (request, reply) => {
      reply
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache, no-transform")
        .header("Connection", "keep-alive");

      const stream = Readable.from(
        (async function* () {
          let invocationId = "";
          const queue: string[] = [];
          let resolvePending: (() => void) | null = null;
          let finished = false;

          const waitForQueue = async () =>
            new Promise<void>((resolve) => {
              resolvePending = resolve;
            });

          const runner = executeHarnessInvocation({
            toolId: request.body.toolId,
            args: request.body.args,
            onEvent(event) {
              invocationId = event.invocationId;
              queue.push(toSseChunk(event));
              resolvePending?.();
              resolvePending = null;
            },
          }).finally(() => {
            finished = true;
            resolvePending?.();
            resolvePending = null;
          });

          while (!finished || queue.length > 0) {
            while (queue.length > 0) {
              yield queue.shift()!;
            }

            if (!finished) {
              await waitForQueue();
            }
          }

          await runner;
          if (invocationId) {
            yield `data: ${JSON.stringify({ type: "invocation:done", invocationId })}\n\n`;
          }
        })(),
      );

      return reply.send(stream);
    }),
  );

  app.get<{ Params: { id: string } }>(
    "/mcp/invocations/:id",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get one MCP invocation",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to get MCP invocation", async (request) => {
      const invocation = getHarnessInvocation(request.params.id);
      if (!invocation) {
        throw mcpNotFound(`Invocation not found: ${request.params.id}`);
      }
      return success(invocation);
    }),
  );

  app.get<{ Params: { id: string } }>(
    "/mcp/invocations/:id/trace",
    {
      schema: {
        tags: ["Tools"],
        summary: "Get one MCP invocation trace",
        response: {
          200: successEnvelope(objectSchema),
        },
      },
    },
    routeHandler("Failed to get MCP invocation trace", async (request) => {
      const trace = getHarnessInvocationTrace(request.params.id);
      if (!trace) {
        throw mcpNotFound(`Invocation trace not found: ${request.params.id}`);
      }
      return success(trace);
    }),
  );

  app.get<{ Params: { id: string } }>(
    "/mcp/invocations/:id/events",
    {
      schema: {
        tags: ["Tools"],
        summary: "List buffered MCP invocation events",
        response: {
          200: successEnvelope({
            type: "array",
            items: objectSchema,
          }),
        },
      },
    },
    routeHandler("Failed to list MCP invocation events", async (request) =>
      success(listHarnessInvocationEvents(request.params.id))),
  );
};

export default mcpRoutes;
