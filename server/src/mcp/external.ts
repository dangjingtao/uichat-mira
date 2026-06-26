import { getSqlite } from "@/db";
import { mcpBadRequest, mcpNotFound } from "./core/errors.js";
import type { McpToolDefinition, McpToolImplementation } from "./core/definitions.js";
import { registerCapability } from "./harness/registry.js";

const MCP_PROTOCOL_VERSION = "2025-06-18";
const DISCLAIMER_TEXT_HASH = "external-mcp-disclaimer-v1";

export type ExternalMcpTransportKind = "streamable-http";
export type ExternalMcpServerStatus = "configured" | "connected" | "failed";
export type ExternalMcpAuthType = "none" | "bearer";

export interface ExternalMcpTransportConfig {
  kind: ExternalMcpTransportKind;
  url: string;
}

export interface CreateExternalMcpServerInput {
  id?: string;
  registryUrl?: string;
  packageName?: string;
  displayName: string;
  description?: string;
  version?: string;
  transport: ExternalMcpTransportConfig;
  disclaimerAccepted: boolean;
  disclaimerTextHash?: string;
}

export interface ExternalMcpDiscoveredTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  projectedCapabilityId: string;
}

export interface ExternalMcpConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "url" | "number" | "json";
  required: boolean;
  secret?: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: unknown;
}

export interface ExternalMcpConfigSchemaResolution {
  fields: ExternalMcpConfigField[];
  completeness: "known-partial" | "known-good" | "unknown";
  sources: Array<"preset" | "marketplace" | "server-self-describe" | "manual">;
  notes?: string[];
}

export interface ExternalMcpServerConfigRecord {
  endpointUrl: string;
  authType: ExternalMcpAuthType;
  timeoutMs: number;
  customHeadersJson: string;
  hasBearerToken: boolean;
}

export interface UpdateExternalMcpServerConfigInput {
  endpointUrl: string;
  authType: ExternalMcpAuthType;
  timeoutMs: number;
  customHeadersJson: string;
  bearerToken?: string | null;
}

export interface ExternalMcpServerRecord {
  id: string;
  source: "registry" | "manual";
  registryUrl?: string;
  packageName?: string;
  displayName: string;
  description?: string;
  version?: string;
  transport: ExternalMcpTransportConfig;
  status: ExternalMcpServerStatus;
  enabled: boolean;
  disclaimerAcceptedAt?: string;
  disclaimerTextHash?: string;
  createdAt: string;
  updatedAt: string;
  lastConnectedAt?: string;
  lastError?: string;
  sessionId?: string;
  protocolVersion?: string;
  discoveredTools: ExternalMcpDiscoveredTool[];
}

interface ExternalMcpRuntimeConfig {
  endpointUrl: string;
  authType: ExternalMcpAuthType;
  timeoutMs: number;
  customHeaders: Record<string, string>;
  bearerToken?: string;
}

interface ExternalMcpServerRow {
  id: string;
  source: "registry" | "manual";
  registry_url: string | null;
  package_name: string | null;
  display_name: string;
  description: string | null;
  version: string | null;
  transport_kind: ExternalMcpTransportKind;
  endpoint_url: string;
  status: ExternalMcpServerStatus;
  enabled: number;
  disclaimer_accepted_at: string | null;
  disclaimer_text_hash: string | null;
  created_at: string;
  updated_at: string;
  last_connected_at: string | null;
  last_error: string | null;
  session_id: string | null;
  protocol_version: string | null;
  discovered_tools_json: string;
  config_json: string;
  secret_json: string;
}

interface JsonRpcResponse<T> {
  jsonrpc?: "2.0";
  id?: string | number | null;
  result?: T;
  error?: {
    code?: number;
    message?: string;
  };
}

interface InitializeResult {
  protocolVersion?: string;
  serverInfo?: {
    name?: string;
    title?: string;
    version?: string;
  };
  capabilities?: Record<string, unknown>;
}

interface ToolsListResult {
  tools?: Array<{
    name?: string;
    title?: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
  }>;
}

const nowIso = () => new Date().toISOString();

const slugifyServerId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const sanitizeServerId = (input: CreateExternalMcpServerInput) => {
  const candidate =
    input.id ??
    input.packageName ??
    input.displayName ??
    new URL(input.transport.url).hostname;
  const id = slugifyServerId(candidate);
  if (!id) {
    throw mcpBadRequest("External MCP server id is required");
  }
  return id;
};

const parseJsonObject = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected JSON object");
  }
  return parsed as Record<string, unknown>;
};

const parseDiscoveredTools = (value: string): ExternalMcpDiscoveredTool[] => {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? (parsed as ExternalMcpDiscoveredTool[]) : [];
  } catch {
    return [];
  }
};

const parseConfigJson = (
  value: string | null | undefined,
): {
  authType?: ExternalMcpAuthType;
  timeoutMs?: number;
  customHeaders?: Record<string, string>;
} => {
  try {
    const parsed = JSON.parse(value || "{}") as {
      authType?: ExternalMcpAuthType;
      timeoutMs?: number;
      customHeaders?: Record<string, string>;
    };
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const parseSecretJson = (
  value: string | null | undefined,
): {
  bearerToken?: string;
} => {
  try {
    const parsed = JSON.parse(value || "{}") as {
      bearerToken?: string;
    };
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const DEFAULT_TIMEOUT_MS = 30000;

const toRuntimeConfig = (row: ExternalMcpServerRow): ExternalMcpRuntimeConfig => {
  const config = parseConfigJson(row.config_json);
  const secret = parseSecretJson(row.secret_json);
  return {
    endpointUrl: row.endpoint_url,
    authType: config.authType === "bearer" ? "bearer" : "none",
    timeoutMs:
      typeof config.timeoutMs === "number" && Number.isFinite(config.timeoutMs) && config.timeoutMs > 0
        ? Math.round(config.timeoutMs)
        : DEFAULT_TIMEOUT_MS,
    customHeaders:
      config.customHeaders && typeof config.customHeaders === "object" ? config.customHeaders : {},
    ...(secret.bearerToken ? { bearerToken: secret.bearerToken } : {}),
  };
};

const serializeHeadersJson = (headers: Record<string, string>) =>
  Object.keys(headers).length === 0 ? "" : JSON.stringify(headers, null, 2);

const toRecord = (row: ExternalMcpServerRow): ExternalMcpServerRecord => ({
  id: row.id,
  source: row.source,
  ...(row.registry_url ? { registryUrl: row.registry_url } : {}),
  ...(row.package_name ? { packageName: row.package_name } : {}),
  displayName: row.display_name,
  ...(row.description ? { description: row.description } : {}),
  ...(row.version ? { version: row.version } : {}),
  transport: {
    kind: row.transport_kind,
    url: row.endpoint_url,
  },
  status: row.status,
  enabled: Boolean(row.enabled),
  ...(row.disclaimer_accepted_at ? { disclaimerAcceptedAt: row.disclaimer_accepted_at } : {}),
  ...(row.disclaimer_text_hash ? { disclaimerTextHash: row.disclaimer_text_hash } : {}),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.last_connected_at ? { lastConnectedAt: row.last_connected_at } : {}),
  ...(row.last_error ? { lastError: row.last_error } : {}),
  ...(row.session_id ? { sessionId: row.session_id } : {}),
  ...(row.protocol_version ? { protocolVersion: row.protocol_version } : {}),
  discoveredTools: parseDiscoveredTools(row.discovered_tools_json),
});

export const initializeExternalMcpDatabase = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS external_mcp_servers (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL CHECK(source IN ('registry', 'manual')),
      registry_url TEXT,
      package_name TEXT,
      display_name TEXT NOT NULL,
      description TEXT,
      version TEXT,
      transport_kind TEXT NOT NULL CHECK(transport_kind IN ('streamable-http')),
      endpoint_url TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('configured', 'connected', 'failed')) DEFAULT 'configured',
      enabled INTEGER NOT NULL DEFAULT 1,
      disclaimer_accepted_at TEXT,
      disclaimer_text_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_connected_at TEXT,
      last_error TEXT,
      session_id TEXT,
      protocol_version TEXT,
      discovered_tools_json TEXT NOT NULL DEFAULT '[]',
      config_json TEXT NOT NULL DEFAULT '{}',
      secret_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE INDEX IF NOT EXISTS idx_external_mcp_servers_status
      ON external_mcp_servers(status);
  `);

  const columns = (
    sqlite.prepare("PRAGMA table_info(external_mcp_servers)").all() as Array<{ name: string }>
  ).map((column) => column.name);

  if (!columns.includes("config_json")) {
    sqlite.exec(
      "ALTER TABLE external_mcp_servers ADD COLUMN config_json TEXT NOT NULL DEFAULT '{}'",
    );
  }

  if (!columns.includes("secret_json")) {
    sqlite.exec(
      "ALTER TABLE external_mcp_servers ADD COLUMN secret_json TEXT NOT NULL DEFAULT '{}'",
    );
  }
};

const getServerRow = (serverId: string): ExternalMcpServerRow | undefined => {
  initializeExternalMcpDatabase();
  return getSqlite()
    .prepare("SELECT * FROM external_mcp_servers WHERE id = ?")
    .get(serverId) as ExternalMcpServerRow | undefined;
};

const getRequiredServer = (serverId: string): ExternalMcpServerRecord => {
  const row = getServerRow(serverId);
  if (!row) {
    throw mcpNotFound(`External MCP server not found: ${serverId}`);
  }
  return toRecord(row);
};

export const listExternalMcpServers = (): ExternalMcpServerRecord[] => {
  initializeExternalMcpDatabase();
  return (
    getSqlite()
      .prepare("SELECT * FROM external_mcp_servers ORDER BY updated_at DESC")
      .all() as ExternalMcpServerRow[]
  ).map(toRecord);
};

export const clearExternalMcpServers = () => {
  initializeExternalMcpDatabase();
  getSqlite().prepare("DELETE FROM external_mcp_servers").run();
};

export const deleteExternalMcpServer = (serverId: string): ExternalMcpServerRecord => {
  const existing = getRequiredServer(serverId);
  initializeExternalMcpDatabase();
  getSqlite()
    .prepare("DELETE FROM external_mcp_servers WHERE id = ?")
    .run(serverId);
  return existing;
};

const validateCustomHeadersJson = (input: string): Record<string, string> => {
  const trimmed = input.trim();
  if (!trimmed) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw mcpBadRequest("Custom headers must be a JSON object");
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw mcpBadRequest("Custom header values must be strings");
    }
    headers[key] = value;
  }
  return headers;
};

export const createExternalMcpServer = (
  input: CreateExternalMcpServerInput,
): ExternalMcpServerRecord => {
  if (!input.disclaimerAccepted) {
    throw mcpBadRequest("External MCP server disclaimer must be accepted before install");
  }
  if (input.transport.kind !== "streamable-http") {
    throw mcpBadRequest("Only streamable-http external MCP transport is supported in MVP");
  }
  const url = new URL(input.transport.url);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw mcpBadRequest("External MCP endpoint must be http or https");
  }
  const id = sanitizeServerId(input);
  const createdAt = nowIso();
  initializeExternalMcpDatabase();
  getSqlite()
    .prepare(
      `
        INSERT INTO external_mcp_servers (
          id, source, registry_url, package_name, display_name, description, version,
          transport_kind, endpoint_url, status, enabled, disclaimer_accepted_at,
          disclaimer_text_hash, created_at, updated_at, discovered_tools_json, config_json, secret_json
        )
        VALUES (@id, @source, @registryUrl, @packageName, @displayName, @description, @version,
          @transportKind, @endpointUrl, 'configured', 1, @disclaimerAcceptedAt,
          @disclaimerTextHash, @createdAt, @updatedAt, '[]', '{}', '{}')
      `,
    )
    .run({
      id,
      source: input.registryUrl ? "registry" : "manual",
      registryUrl: input.registryUrl ?? null,
      packageName: input.packageName ?? null,
      displayName: input.displayName.trim(),
      description: input.description ?? null,
      version: input.version ?? null,
      transportKind: input.transport.kind,
      endpointUrl: url.toString(),
      disclaimerAcceptedAt: createdAt,
      disclaimerTextHash: input.disclaimerTextHash ?? DISCLAIMER_TEXT_HASH,
      createdAt,
      updatedAt: createdAt,
    });
  return getRequiredServer(id);
};

export const getExternalMcpServerConfigSchema = (
  serverId: string,
): ExternalMcpConfigSchemaResolution => {
  const server = getRequiredServer(serverId);
  return {
    fields: [
      {
        key: "endpointUrl",
        label: "Endpoint URL",
        type: "url",
        required: true,
        defaultValue: server.transport.url,
      },
      {
        key: "bearerToken",
        label: "Bearer Token",
        type: "password",
        required: false,
        secret: true,
        placeholder: "sk-...",
        description: "Optional token used as Authorization: Bearer <token>.",
      },
      {
        key: "customHeadersJson",
        label: "Custom Headers JSON",
        type: "json",
        required: false,
        placeholder: '{\n  "X-Org-Id": "demo"\n}',
      },
      {
        key: "timeoutMs",
        label: "Timeout (ms)",
        type: "number",
        required: true,
        defaultValue: DEFAULT_TIMEOUT_MS,
      },
    ],
    completeness: "known-partial",
    sources: server.source === "registry" ? ["marketplace", "manual"] : ["manual"],
    notes: [
      "This schema is a known configuration draft for streamable-http MCP servers and may be incomplete.",
    ],
  };
};

export const getExternalMcpServerConfig = (
  serverId: string,
): ExternalMcpServerConfigRecord => {
  const row = getServerRow(serverId);
  if (!row) {
    throw mcpNotFound(`External MCP server not found: ${serverId}`);
  }
  const runtimeConfig = toRuntimeConfig(row);
  return {
    endpointUrl: runtimeConfig.endpointUrl,
    authType: runtimeConfig.authType,
    timeoutMs: runtimeConfig.timeoutMs,
    customHeadersJson: serializeHeadersJson(runtimeConfig.customHeaders),
    hasBearerToken: Boolean(runtimeConfig.bearerToken),
  };
};

export const updateExternalMcpServerConfig = (
  serverId: string,
  input: UpdateExternalMcpServerConfigInput,
): ExternalMcpServerConfigRecord => {
  const row = getServerRow(serverId);
  if (!row) {
    throw mcpNotFound(`External MCP server not found: ${serverId}`);
  }

  const url = new URL(input.endpointUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw mcpBadRequest("External MCP endpoint must be http or https");
  }

  if (!Number.isFinite(input.timeoutMs) || input.timeoutMs <= 0) {
    throw mcpBadRequest("Timeout must be a positive number");
  }

  const customHeaders = validateCustomHeadersJson(input.customHeadersJson);
  const previousSecret = parseSecretJson(row.secret_json);
  const nextBearerToken =
    input.bearerToken === undefined
      ? previousSecret.bearerToken
      : input.bearerToken === null || input.bearerToken.trim() === ""
        ? undefined
        : input.bearerToken.trim();
  const nextAuthType =
    input.authType === "bearer" && nextBearerToken ? "bearer" : "none";
  const at = nowIso();

  getSqlite()
    .prepare(
      `
        UPDATE external_mcp_servers
        SET endpoint_url = @endpointUrl,
            config_json = @configJson,
            secret_json = @secretJson,
            status = 'configured',
            session_id = NULL,
            protocol_version = NULL,
            last_error = NULL,
            updated_at = @at
        WHERE id = @id
      `,
    )
    .run({
      id: serverId,
      endpointUrl: url.toString(),
      configJson: JSON.stringify({
        authType: nextAuthType,
        timeoutMs: Math.round(input.timeoutMs),
        customHeaders,
      }),
      secretJson: JSON.stringify({
        ...(nextBearerToken ? { bearerToken: nextBearerToken } : {}),
      }),
      at,
    });

  return getExternalMcpServerConfig(serverId);
};

const parseJsonRpcResponse = async <T>(response: Response): Promise<JsonRpcResponse<T>> => {
  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();
  const payload = contentType.includes("text/event-stream")
    ? body
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .find((line) => line && line !== "[DONE]")
    : body;

  if (!payload) {
    throw new Error("MCP server returned an empty response");
  }
  return parseJsonObject(payload) as JsonRpcResponse<T>;
};

const postJsonRpc = async <T>(
  server: ExternalMcpServerRecord,
  method: string,
  params: Record<string, unknown>,
  sessionId?: string,
): Promise<{ result: T; sessionId?: string; protocolVersion?: string }> => {
  const row = getServerRow(server.id);
  if (!row) {
    throw mcpNotFound(`External MCP server not found: ${server.id}`);
  }
  const runtimeConfig = toRuntimeConfig(row);
  const id = crypto.randomUUID();
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": server.protocolVersion ?? MCP_PROTOCOL_VERSION,
    ...runtimeConfig.customHeaders,
  };
  if (runtimeConfig.authType === "bearer" && runtimeConfig.bearerToken) {
    headers.Authorization = `Bearer ${runtimeConfig.bearerToken}`;
  }
  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }

  const response = await fetch(runtimeConfig.endpointUrl, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(runtimeConfig.timeoutMs),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`MCP ${method} failed with HTTP ${response.status}`);
  }
  const message = await parseJsonRpcResponse<T>(response);
  if (message.error) {
    throw new Error(message.error.message ?? `MCP ${method} failed`);
  }
  if (message.result === undefined) {
    throw new Error(`MCP ${method} response did not include result`);
  }
  return {
    result: message.result,
    sessionId: response.headers.get("mcp-session-id") ?? undefined,
    protocolVersion: response.headers.get("mcp-protocol-version") ?? undefined,
  };
};

const sendInitializedNotification = async (
  server: ExternalMcpServerRecord,
  sessionId?: string,
) => {
  const row = getServerRow(server.id);
  if (!row) {
    throw mcpNotFound(`External MCP server not found: ${server.id}`);
  }
  const runtimeConfig = toRuntimeConfig(row);
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": server.protocolVersion ?? MCP_PROTOCOL_VERSION,
    ...runtimeConfig.customHeaders,
  };
  if (runtimeConfig.authType === "bearer" && runtimeConfig.bearerToken) {
    headers.Authorization = `Bearer ${runtimeConfig.bearerToken}`;
  }
  if (sessionId) {
    headers["Mcp-Session-Id"] = sessionId;
  }
  await fetch(runtimeConfig.endpointUrl, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(runtimeConfig.timeoutMs),
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  });
};

export const connectExternalMcpServer = async (
  serverId: string,
): Promise<ExternalMcpServerRecord> => {
  const server = getRequiredServer(serverId);
  try {
    const initialized = await postJsonRpc<InitializeResult>(server, "initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "ui-chat-rag-tester",
        version: "0.7.1",
      },
    });
    const protocolVersion =
      initialized.result.protocolVersion ?? initialized.protocolVersion ?? MCP_PROTOCOL_VERSION;
    const sessionId = initialized.sessionId;
    const at = nowIso();
    initializeExternalMcpDatabase();
    getSqlite()
      .prepare(
        `
          UPDATE external_mcp_servers
          SET status = 'connected',
              last_connected_at = @at,
              last_error = NULL,
              session_id = @sessionId,
              protocol_version = @protocolVersion,
              updated_at = @at
          WHERE id = @id
        `,
      )
      .run({ id: serverId, sessionId: sessionId ?? null, protocolVersion, at });
    await sendInitializedNotification(
      { ...server, sessionId, protocolVersion },
      sessionId,
    );
  } catch (error) {
    const at = nowIso();
    getSqlite()
      .prepare(
        `
          UPDATE external_mcp_servers
          SET status = 'failed', last_error = @lastError, updated_at = @at
          WHERE id = @id
        `,
      )
      .run({
        id: serverId,
        lastError: error instanceof Error ? error.message : String(error),
        at,
      });
    throw error;
  }
  return getRequiredServer(serverId);
};

const toProjectedCapabilityId = (serverId: string, toolName: string) =>
  `mcp:${serverId}:tool:${slugifyServerId(toolName)}`;

const normalizeDiscoveredTools = (
  serverId: string,
  tools: ToolsListResult["tools"],
): ExternalMcpDiscoveredTool[] =>
  (tools ?? [])
    .filter((tool) => typeof tool.name === "string" && tool.name.trim())
    .map((tool) => ({
      name: tool.name!.trim(),
      title: tool.title?.trim() || tool.name!.trim(),
      description: tool.description ?? "",
      inputSchema: tool.inputSchema ?? { type: "object", additionalProperties: true },
      ...(tool.outputSchema ? { outputSchema: tool.outputSchema } : {}),
      projectedCapabilityId: toProjectedCapabilityId(serverId, tool.name!.trim()),
    }));

const registerProjectedTool = (
  server: ExternalMcpServerRecord,
  tool: ExternalMcpDiscoveredTool,
) => {
  const implementation: McpToolImplementation = {
    definition: {
      id: tool.projectedCapabilityId,
      title: tool.title,
      description: tool.description || `MCP capability ${tool.name} from ${server.displayName}`,
      domain: "web_search",
      mode: "sync",
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      tags: ["mcp", "external", server.id],
      capabilities: {
        sideEffect: "network",
        requiresApproval: true,
        networkAccess: true,
        longRunning: true,
      },
    } satisfies McpToolDefinition,
    execute: async (context) => {
      context.pushEvent({
        type: "invocation:progress",
        message: `Calling MCP capability ${tool.name} on ${server.displayName}`,
      });
      const latestServer = getRequiredServer(server.id);
      const response = await postJsonRpc<unknown>(
        latestServer,
        "tools/call",
        {
          name: tool.name,
          arguments: context.args,
        },
        latestServer.sessionId,
      );
      return { result: response.result };
    },
  };
  registerCapability(implementation);
};

export const registerExternalMcpServerCapabilities = (
  server: ExternalMcpServerRecord,
) => {
  for (const tool of server.discoveredTools) {
    registerProjectedTool(server, tool);
  }
};

export const registerAllExternalMcpCapabilities = () => {
  for (const server of listExternalMcpServers()) {
    registerExternalMcpServerCapabilities(server);
  }
};

export const discoverExternalMcpServer = async (
  serverId: string,
): Promise<ExternalMcpServerRecord> => {
  let server = getRequiredServer(serverId);
  if (server.status !== "connected") {
    server = await connectExternalMcpServer(serverId);
  }
  const response = await postJsonRpc<ToolsListResult>(
    server,
    "tools/list",
    {},
    server.sessionId,
  );
  const discoveredTools = normalizeDiscoveredTools(server.id, response.result.tools);
  const at = nowIso();
  getSqlite()
    .prepare(
      `
        UPDATE external_mcp_servers
        SET discovered_tools_json = @discoveredToolsJson,
            last_error = NULL,
            updated_at = @at
        WHERE id = @id
      `,
    )
    .run({
      id: server.id,
      discoveredToolsJson: JSON.stringify(discoveredTools),
      at,
    });
  const updated = getRequiredServer(server.id);
  registerExternalMcpServerCapabilities(updated);
  return updated;
};
