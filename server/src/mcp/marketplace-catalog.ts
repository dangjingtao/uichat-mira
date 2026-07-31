import {
  createMcpMarketplaceRepository,
  type MarketplaceCatalogQuery,
  type MarketplaceCatalogRecord,
  type MarketplaceSyncMode,
  type MarketplaceSyncState,
} from "@/db/repositories/mcp-marketplace.repository.js";
import {
  fetchMcpMarketplaceRegistryPage,
  type FetchMcpMarketplaceServersInput,
  type McpMarketplaceRegistryEntry,
} from "./marketplace.js";

export const MCP_MARKETPLACE_SOURCE_URL =
  "https://registry.modelcontextprotocol.io/v0.1/servers";
const AUTO_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const AUTO_SYNC_RETRY_BASE_MS = 60 * 1000;
const AUTO_SYNC_RETRY_MAX_MS = AUTO_SYNC_INTERVAL_MS;
const FULL_SYNC_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const INCREMENTAL_OVERLAP_MS = 5 * 60 * 1000;
const CATEGORY_RULE_VERSION = 1;
export const MCP_MARKETPLACE_MAX_ENTRIES = 100;
const REGISTRY_PAGE_SIZE = 100;

const categoryRules: Array<{ id: string; words: string[] }> = [
  {
    id: "developer-tools",
    words: ["github", "gitlab", "code", "developer", "npm", "debug", "database schema"],
  },
  { id: "data", words: ["database", "sql", "postgres", "mysql", "analytics", "data warehouse"] },
  { id: "search-knowledge", words: ["search", "knowledge", "rag", "documentation", "docs", "wiki"] },
  { id: "browser-automation", words: ["browser", "playwright", "selenium", "scrape", "web automation"] },
  { id: "files-office", words: ["file", "document", "pdf", "excel", "spreadsheet", "office", "drive"] },
  { id: "cloud-devops", words: ["cloud", "aws", "azure", "docker", "kubernetes", "devops", "deploy"] },
  { id: "communication", words: ["slack", "email", "mail", "calendar", "teams", "discord", "message"] },
];

const inferCategory = (entry: McpMarketplaceRegistryEntry) => {
  const packageIds = entry.server.transports
    .map((item) => ("packageIdentifier" in item ? item.packageIdentifier : ""))
    .filter(Boolean);
  const text = [
    entry.server.name,
    entry.server.title,
    entry.server.description,
    ...packageIds,
  ]
    .join("\n")
    .toLocaleLowerCase();
  const matched = categoryRules.find((rule) =>
    rule.words.some((word) => text.includes(word)),
  );
  return matched
    ? { category: matched.id, categorySource: "inferred" as const }
    : { category: "other", categorySource: "uncategorized" as const };
};

const toRecord = (
  entry: McpMarketplaceRegistryEntry,
  sourceUrl: string,
  syncedAt: string,
): MarketplaceCatalogRecord => {
  const category = inferCategory(entry);
  return {
    server: entry.server,
    sourceUrl,
    ...category,
    categoryRuleVersion: CATEGORY_RULE_VERSION,
    deleted: entry.server.status === "deleted",
    syncedAt,
  };
};

const subtractOverlap = (value: string | null) => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Date(timestamp - INCREMENTAL_OVERLAP_MS).toISOString()
    : undefined;
};

const isOlderThan = (value: string | null, durationMs: number, now: number) =>
  !value || now - Date.parse(value) >= durationMs;

const sanitizeError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]+/g, " ").slice(0, 500);
};

type RegistryPageFetcher = typeof fetchMcpMarketplaceRegistryPage;

export const createMcpMarketplaceCatalog = (options?: {
  repository?: ReturnType<typeof createMcpMarketplaceRepository>;
  fetchPage?: RegistryPageFetcher;
  now?: () => Date;
  sourceUrl?: string;
}) => {
  const repository = options?.repository ?? createMcpMarketplaceRepository();
  const fetchPage = options?.fetchPage ?? fetchMcpMarketplaceRegistryPage;
  const now = options?.now ?? (() => new Date());
  const sourceUrl = options?.sourceUrl ?? MCP_MARKETPLACE_SOURCE_URL;
  repository.initialize();
  let syncInFlight: Promise<MarketplaceSyncState> | null = null;
  let autoSyncEnabled = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAtMs: number | null = null;
  let consecutiveFailures = 0;
  let hasStartedSync = false;
  const searchesInFlight = new Map<string, Promise<void>>();
  const searchesCompletedAt = new Map<string, number>();

  const getStatus = () => {
    const state = repository.getSyncState(sourceUrl);
    const nextAutoSyncAt =
      state.status === "failed" && retryAtMs !== null
        ? new Date(retryAtMs).toISOString()
        : state.lastSuccessfulSyncAt
          ? new Date(
              Date.parse(state.lastSuccessfulSyncAt) + AUTO_SYNC_INTERVAL_MS,
            ).toISOString()
          : null;
    return {
      ...state,
      nextAutoSyncAt,
    };
  };

  const clearRetryTimer = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };

  const getRetryDelay = () =>
    Math.min(
      AUTO_SYNC_RETRY_BASE_MS * 2 ** Math.max(0, consecutiveFailures - 1),
      AUTO_SYNC_RETRY_MAX_MS,
    );

  const armRetryTimer = (mode: MarketplaceSyncMode) => {
    clearRetryTimer();
    if (!autoSyncEnabled || retryAtMs === null) return;
    const delay = Math.max(0, retryAtMs - now().getTime());
    retryTimer = setTimeout(() => {
      retryTimer = null;
      retryAtMs = null;
      void startSync(mode).catch(() => undefined);
    }, delay);
    retryTimer.unref();
  };

  const scheduleRetry = (mode: MarketplaceSyncMode) => {
    retryAtMs = now().getTime() + getRetryDelay();
    armRetryTimer(mode);
  };

  const runSync = async (requestedMode?: MarketplaceSyncMode) => {
    const previous = repository.getSyncState(sourceUrl);
    const startedAt = now().toISOString();
    const mode: MarketplaceSyncMode =
      requestedMode ??
      (repository.countVisible(sourceUrl) === 0 ||
      isOlderThan(previous.lastFullSyncAt, FULL_SYNC_INTERVAL_MS, now().getTime())
        ? "full"
        : "incremental");
    repository.setSyncState({
      ...previous,
      status: "syncing",
      mode,
      lastAttemptAt: startedAt,
      updatedCount: 0,
      lastError: null,
    });

    try {
      const request: FetchMcpMarketplaceServersInput = {
        sourceUrl,
        limit: REGISTRY_PAGE_SIZE,
        version: "latest",
        includeDeleted: mode === "incremental" ? true : undefined,
        updatedSince:
          mode === "incremental"
            ? subtractOverlap(previous.watermark ?? previous.lastSuccessfulSyncAt)
            : undefined,
      };
      const page = await fetchPage(request);
      const pageSyncedAt = now().toISOString();
      const records = page.entries.map((entry) =>
        toRecord(entry, sourceUrl, pageSyncedAt),
      );
      repository.upsertPage(sourceUrl, records, MCP_MARKETPLACE_MAX_ENTRIES);
      const updatedCount = records.length;

      const finishedAt = now().toISOString();
      const nextState: MarketplaceSyncState = {
        sourceUrl,
        status: "idle",
        mode,
        lastAttemptAt: startedAt,
        lastSuccessfulSyncAt: finishedAt,
        lastFullSyncAt: mode === "full" ? finishedAt : previous.lastFullSyncAt,
        watermark: finishedAt,
        updatedCount,
        lastError: null,
      };
      repository.setSyncState(nextState);
      consecutiveFailures = 0;
      retryAtMs = null;
      clearRetryTimer();
      return nextState;
    } catch (error) {
      consecutiveFailures += 1;
      const failedState: MarketplaceSyncState = {
        ...repository.getSyncState(sourceUrl),
        sourceUrl,
        status: "failed",
        mode,
        lastAttemptAt: startedAt,
        lastError: sanitizeError(error),
      };
      repository.setSyncState(failedState);
      scheduleRetry(mode);
      return failedState;
    }
  };

  const startSync = (mode?: MarketplaceSyncMode) => {
    if (syncInFlight) return syncInFlight;
    hasStartedSync = true;
    retryAtMs = null;
    clearRetryTimer();
    syncInFlight = runSync(mode).finally(() => {
      syncInFlight = null;
    });
    return syncInFlight;
  };

  const maybeStartSync = () => {
    const state = repository.getSyncState(sourceUrl);
    if (state.status === "failed" && hasStartedSync) return;
    const timestamp = now().getTime();
    if (
      repository.countVisible(sourceUrl) === 0 ||
      isOlderThan(state.lastSuccessfulSyncAt, AUTO_SYNC_INTERVAL_MS, timestamp)
    ) {
      void startSync().catch(() => undefined);
    }
  };

  const maybeSearchRegistry = (query: string) => {
    const normalized = query.trim().toLocaleLowerCase();
    const lastCompletedAt = searchesCompletedAt.get(normalized);
    if (searchesInFlight.has(normalized)) return true;
    if (
      !normalized ||
      (lastCompletedAt !== undefined &&
        now().getTime() - lastCompletedAt < 5 * 60 * 1000)
    ) {
      return false;
    }
    const task = fetchPage({
      sourceUrl,
      query: query.trim(),
      limit: REGISTRY_PAGE_SIZE,
      version: "latest",
    })
      .then((page) => {
        const syncedAt = now().toISOString();
        repository.upsertPage(
          sourceUrl,
          page.entries.map((entry) => toRecord(entry, sourceUrl, syncedAt)),
          MCP_MARKETPLACE_MAX_ENTRIES,
        );
      })
      .catch(() => undefined)
      .finally(() => {
        searchesInFlight.delete(normalized);
        searchesCompletedAt.set(normalized, now().getTime());
      });
    searchesInFlight.set(normalized, task);
    return true;
  };

  return {
    list(input: MarketplaceCatalogQuery) {
      const result = repository.list(sourceUrl, input);
      const state = repository.getSyncState(sourceUrl);
      const searchPending =
        result.servers.length === 0 && input.query?.trim()
          ? maybeSearchRegistry(input.query)
          : false;
      maybeStartSync();
      return {
        servers: result.servers,
        metadata: {
          count: result.servers.length,
          nextCursor: result.nextCursor,
          sourceUrl,
          cache: {
            hit: true,
            stale: state.status === "failed",
            cachedAt: state.lastSuccessfulSyncAt,
          },
          sync: getStatus(),
          searchPending,
        },
      };
    },
    getStatus,
    requestSync(mode?: MarketplaceSyncMode) {
      const requestedMode =
        repository.countVisible(sourceUrl) === 0 ? "full" : mode ?? "incremental";
      const task = startSync(requestedMode);
      return { task, status: getStatus() };
    },
    startAutoSync() {
      autoSyncEnabled = true;
      const timer = setInterval(maybeStartSync, AUTO_SYNC_INTERVAL_MS);
      timer.unref();
      const state = repository.getSyncState(sourceUrl);
      if (state.status === "failed" && retryAtMs !== null && state.mode) {
        armRetryTimer(state.mode);
      }
      return () => {
        autoSyncEnabled = false;
        clearInterval(timer);
        clearRetryTimer();
      };
    },
  };
};
