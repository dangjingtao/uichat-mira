import { mcpBadRequest, mcpInternalError } from "./core/errors.js";

const DEFAULT_REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0/servers";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type RegistryTransport = {
  type?: unknown;
  url?: unknown;
};

type RegistryPackage = {
  registry_type?: unknown;
  identifier?: unknown;
  version?: unknown;
  transport?: RegistryTransport;
};

type RegistryServer = {
  name?: unknown;
  title?: unknown;
  description?: unknown;
  version?: unknown;
  remotes?: unknown;
  packages?: unknown;
};

type RegistryEntry = {
  server?: RegistryServer;
  _meta?: Record<string, unknown>;
};

export type McpMarketplaceTransport = {
  kind: "stdio" | "streamable-http";
  url?: string;
  command?: string;
  args?: string[];
};

export type McpMarketplaceServer = {
  id: string;
  name: string;
  title: string;
  description: string;
  version: string | null;
  status: string | null;
  isLatest: boolean | null;
  publishedAt: string | null;
  updatedAt: string | null;
  transports: McpMarketplaceTransport[];
};

export type McpMarketplaceServersResult = {
  servers: McpMarketplaceServer[];
  metadata: {
    count: number;
    nextCursor: string | null;
    sourceUrl: string;
  };
};

export type FetchMcpMarketplaceServersInput = {
  cursor?: string;
  limit?: number;
  query?: string;
  sourceUrl?: string;
  fetchImpl?: typeof fetch;
};

const officialMetaKey = "io.modelcontextprotocol.registry/official";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringOrNull = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null;

const booleanOrNull = (value: unknown) =>
  typeof value === "boolean" ? value : null;

const normalizeLimit = (value: number | undefined) => {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }

  if (!Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
    throw mcpBadRequest(`limit must be an integer from 1 to ${MAX_LIMIT}`);
  }

  return value;
};

const normalizeRemoteTransport = (remote: RegistryTransport): McpMarketplaceTransport | null => {
  const type = stringOrNull(remote.type);
  if (type !== "streamable-http") {
    return null;
  }

  const url = stringOrNull(remote.url);
  if (!url) {
    return null;
  }

  return {
    kind: "streamable-http",
    url,
  };
};

const normalizePackageTransport = (pkg: RegistryPackage): McpMarketplaceTransport | null => {
  const transport = isRecord(pkg.transport) ? pkg.transport : null;
  if (!transport) {
    return null;
  }

  const type = stringOrNull(transport.type);
  if (type !== "stdio") {
    return null;
  }

  const identifier = stringOrNull(pkg.identifier);
  if (!identifier) {
    return null;
  }

  const registryType = stringOrNull(pkg.registry_type);
  const command = registryType === "npm" ? "npx" : identifier;
  const args = registryType === "npm" ? ["-y", identifier] : [];

  return {
    kind: "stdio",
    command,
    args,
  };
};

const normalizeTransports = (server: RegistryServer): McpMarketplaceTransport[] => {
  const remoteTransports = Array.isArray(server.remotes)
    ? server.remotes
        .filter(isRecord)
        .map((remote) => normalizeRemoteTransport(remote))
        .filter((transport): transport is McpMarketplaceTransport => Boolean(transport))
    : [];

  const packageTransports = Array.isArray(server.packages)
    ? server.packages
        .filter(isRecord)
        .map((pkg) => normalizePackageTransport(pkg))
        .filter((transport): transport is McpMarketplaceTransport => Boolean(transport))
    : [];

  return [...remoteTransports, ...packageTransports];
};

const normalizeServerEntry = (entry: RegistryEntry): McpMarketplaceServer | null => {
  const server = isRecord(entry.server) ? entry.server : null;
  if (!server) {
    return null;
  }

  const name = stringOrNull(server.name);
  if (!name) {
    return null;
  }

  const meta = isRecord(entry._meta?.[officialMetaKey])
    ? entry._meta[officialMetaKey]
    : {};

  return {
    id: name,
    name,
    title: stringOrNull(server.title) ?? name,
    description: stringOrNull(server.description) ?? "",
    version: stringOrNull(server.version),
    status: stringOrNull(meta.status),
    isLatest: booleanOrNull(meta.isLatest),
    publishedAt: stringOrNull(meta.publishedAt),
    updatedAt: stringOrNull(meta.updatedAt),
    transports: normalizeTransports(server),
  };
};

export const normalizeMarketplaceServersPayload = (
  payload: unknown,
  sourceUrl: string,
  query?: string,
): McpMarketplaceServersResult => {
  if (!isRecord(payload) || !Array.isArray(payload.servers)) {
    throw mcpInternalError("MCP registry response is missing servers[]");
  }

  const normalizedQuery = query?.trim().toLocaleLowerCase();
  const servers = payload.servers
    .filter(isRecord)
    .map((entry) => normalizeServerEntry(entry))
    .filter((server): server is McpMarketplaceServer => Boolean(server))
    .filter((server) => {
      if (!normalizedQuery) {
        return true;
      }

      return [server.name, server.title, server.description]
        .join("\n")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });

  const metadata = isRecord(payload.metadata) ? payload.metadata : {};

  return {
    servers,
    metadata: {
      count: typeof metadata.count === "number" ? metadata.count : servers.length,
      nextCursor: stringOrNull(metadata.nextCursor),
      sourceUrl,
    },
  };
};

export const fetchMcpMarketplaceServers = async (
  input: FetchMcpMarketplaceServersInput = {},
): Promise<McpMarketplaceServersResult> => {
  const sourceUrl = input.sourceUrl ?? DEFAULT_REGISTRY_URL;
  const url = new URL(sourceUrl);
  url.searchParams.set("limit", String(normalizeLimit(input.limit)));

  if (input.cursor?.trim()) {
    url.searchParams.set("cursor", input.cursor.trim());
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw mcpInternalError(`MCP registry request failed with status ${response.status}`);
  }

  const payload = await response.json();
  return normalizeMarketplaceServersPayload(payload, sourceUrl, input.query);
};
