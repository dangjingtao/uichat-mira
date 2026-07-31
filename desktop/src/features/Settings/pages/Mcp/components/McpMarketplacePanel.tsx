import { useMemo, useState } from "react";
import { Download, Info, Loader2 } from "lucide-react";
import type { McpMarketplaceServer } from "@/shared/api/tools";
import type { McpMarketplaceSyncStatus } from "@/shared/api/tools";
import Badge from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import SegmentedTabs from "@/shared/ui/SegmentedTabs";
import { Select } from "@/shared/ui/Select";
import McpMarketplaceDetailsDrawer from "./McpMarketplaceDetailsDrawer";

export type MarketplaceFilter = "all" | "installable" | "remote" | "local";

type McpMarketplacePanelProps = {
  hasMore: boolean;
  isLoading: boolean;
  isSearching: boolean;
  servers: McpMarketplaceServer[];
  activeFilter: MarketplaceFilter;
  activeCategory: string;
  syncStatus: McpMarketplaceSyncStatus | null;
  cacheInfo: {
    hit: boolean;
    stale: boolean;
    cachedAt: string | null;
  } | null;
  labels: {
    cachedResult: string;
    emptyDescription: string;
    emptyTitle: string;
    install: string;
    details: string;
    unsupported: string;
    loadMore: string;
    loading: string;
    transports: string;
    filterLabel: string;
    categoryLabel: string;
    categories: Record<string, string>;
    syncing: string;
    syncFailed: string;
    lastUpdated: string;
    filters: {
      all: string;
      installable: string;
      remote: string;
      local: string;
    };
    detailsDrawer: {
      close: string;
      details: string;
      description: string;
      identity: string;
      version: string;
      status: string;
      publishedAt: string;
      updatedAt: string;
      website: string;
      repository: string;
      links: string;
      transports: string;
      endpoint: string;
      command: string;
      packageIdentifier: string;
      installable: string;
      notInstallable: string;
      unknown: string;
    };
  };
  onInstall: (server: McpMarketplaceServer) => void;
  onLoadMore: () => void;
  onFilterChange: (filter: MarketplaceFilter) => void;
  onCategoryChange: (category: string) => void;
};

function formatTransport(transport: McpMarketplaceServer["transports"][number]) {
  if (transport.kind === "streamable-http") {
    return "Remote HTTP";
  }

  if (transport.kind === "stdio") {
    return `npm · ${transport.packageIdentifier}`;
  }

  return `${transport.packageType} · ${transport.packageIdentifier}`;
}

function formatTransportSummary(server: McpMarketplaceServer) {
  if (server.transports.length === 0) {
    return "unknown";
  }

  return server.transports.map(formatTransport).join(", ");
}

export default function McpMarketplacePanel({
  hasMore,
  isLoading,
  isSearching,
  servers,
  activeFilter,
  activeCategory,
  syncStatus,
  cacheInfo,
  labels,
  onInstall,
  onLoadMore,
  onFilterChange,
  onCategoryChange,
}: McpMarketplacePanelProps) {
  const [selectedServer, setSelectedServer] = useState<McpMarketplaceServer | null>(null);
  const filterItems = useMemo(
    () => [
      { value: "all" as const, label: labels.filters.all },
      { value: "installable" as const, label: labels.filters.installable },
      { value: "remote" as const, label: labels.filters.remote },
      { value: "local" as const, label: labels.filters.local },
    ],
    [labels.filters],
  );
  const categoryOptions = useMemo(
    () =>
      Object.entries(labels.categories).map(([value, label]) => ({
        value,
        label,
      })),
    [labels.categories],
  );

  return (
    <div className="min-h-0">
      <div className="sticky top-0 z-10 border-b border-border bg-surface-primary px-5 py-4">
        {syncStatus?.status === "syncing" ? (
          <div className="mb-3 flex items-center gap-2 text-xs text-text-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" />
            {labels.syncing}
          </div>
        ) : null}
        {syncStatus?.status === "failed" ? (
          <div className="mb-3 text-xs text-amber-700">
            {labels.syncFailed}
            {syncStatus.lastError ? `：${syncStatus.lastError}` : ""}
          </div>
        ) : null}
        {syncStatus?.status === "idle" && syncStatus.lastSuccessfulSyncAt ? (
          <div className="mb-3 text-xs text-text-tertiary">
            {labels.lastUpdated} {syncStatus.lastSuccessfulSyncAt}
          </div>
        ) : null}
        {cacheInfo?.stale ? (
          <div className="mb-3 text-xs text-amber-700">
            {labels.cachedResult}
            {cacheInfo.cachedAt ? ` (${cacheInfo.cachedAt})` : ""}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-tertiary">{labels.filterLabel}</span>
          <SegmentedTabs
            items={filterItems}
            value={activeFilter}
            onChange={onFilterChange}
            size="sm"
          />
          <div className="ml-2 flex items-center gap-2">
            <span className="text-xs text-text-tertiary">
              {labels.categoryLabel}
            </span>
            <div className="w-32">
              <Select
                value={activeCategory}
                onChange={onCategoryChange}
                options={categoryOptions}
                compact
              />
            </div>
          </div>
          <span className="text-xs text-text-tertiary">
            {servers.length}
          </span>
        </div>
      </div>

      {isLoading && servers.length === 0 ? (
        <div className="space-y-3 px-5 py-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`mcp-market-skeleton-${index}`}
              className="rounded-ui-control border border-border/70 bg-surface-secondary/35 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-40 animate-pulse rounded bg-surface-secondary" />
                    <div className="h-5 w-14 animate-pulse rounded-full bg-surface-secondary" />
                  </div>
                  <div className="h-3 w-28 animate-pulse rounded bg-surface-secondary" />
                  <div className="space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-surface-secondary" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-surface-secondary" />
                  </div>
                  <div className="flex gap-2">
                    <div className="h-5 w-24 animate-pulse rounded-full bg-surface-secondary" />
                    <div className="h-5 w-24 animate-pulse rounded-full bg-surface-secondary" />
                  </div>
                </div>
                <div className="h-8 w-20 animate-pulse rounded-ui-control bg-surface-secondary" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {servers.length > 0 ? (
        <div className="divide-y divide-border">
          {servers.map((server) => {
            const installable = server.transports.some((item) => item.installable);
            return (
              <div key={server.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {server.title}
                      </div>
                      {server.version ? <Badge variant="muted">{server.version}</Badge> : null}
                      {server.status ? <Badge variant="muted">{server.status}</Badge> : null}
                      {server.isLatest === true ? <Badge variant="success">latest</Badge> : null}
                    </div>
                    <div className="mt-1 break-all text-xs text-text-tertiary">{server.id}</div>
                    <div className="mt-2 line-clamp-3 text-sm leading-6 text-text-secondary">
                      {server.description || server.name}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-text-tertiary">{labels.transports}</span>
                      {server.transports.length > 0 ? (
                        server.transports.map((transport, index) => (
                          <Badge
                            key={`${server.id}-${formatTransport(transport)}-${index}`}
                            variant="muted"
                          >
                            {formatTransport(transport)}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="muted">unknown</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedServer(server)}
                    >
                      <Info className="h-4 w-4" />
                      {labels.details}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onInstall(server)}
                      disabled={!installable}
                      title={formatTransportSummary(server)}
                    >
                      <Download className="h-4 w-4" />
                      {installable ? labels.install : labels.unsupported}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

        </div>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center border-t border-border px-5 py-4">
          <Button variant="secondary" size="sm" onClick={onLoadMore} disabled={isLoading}>
            {isLoading && !isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isLoading && !isSearching ? labels.loading : labels.loadMore}
          </Button>
        </div>
      ) : null}

      {isSearching && servers.length > 0 ? (
        <div className="border-t border-border px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <Loader2 className="h-4 w-4 animate-spin" />
            {labels.loading}
          </div>
        </div>
      ) : null}

      {servers.length === 0 ? (
        <div className="px-5 py-8">
          <div className="text-sm font-medium text-text-primary">{labels.emptyTitle}</div>
          <div className="mt-1 text-sm text-text-secondary">
            {isLoading ? labels.loading : labels.emptyDescription}
          </div>
        </div>
      ) : null}

      <McpMarketplaceDetailsDrawer
        server={selectedServer}
        onClose={() => setSelectedServer(null)}
        onInstall={onInstall}
        labels={{
          ...labels.detailsDrawer,
          install: labels.install,
          unsupported: labels.unsupported,
        }}
      />
    </div>
  );
}
