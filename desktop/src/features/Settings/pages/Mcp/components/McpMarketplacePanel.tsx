import { Download, Loader2 } from "lucide-react";
import Badge from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import type { McpMarketplaceServer } from "@/shared/api/tools";

type McpMarketplacePanelProps = {
  hasMore: boolean;
  isLoading: boolean;
  isSearching: boolean;
  servers: McpMarketplaceServer[];
  sourceUrl: string | null;
  cacheInfo: {
    hit: boolean;
    stale: boolean;
    cachedAt: string | null;
  } | null;
  labels: {
    activeSource: string;
    cachedResult: string;
    emptyDescription: string;
    emptyTitle: string;
    install: string;
    loadMore: string;
    loading: string;
    title: string;
    transports: string;
  };
  onInstall: (server: McpMarketplaceServer) => void;
  onLoadMore: () => void;
};

function formatTransport(transport: McpMarketplaceServer["transports"][number]) {
  if (transport.kind === "streamable-http") {
    return "remote";
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
  sourceUrl,
  cacheInfo,
  labels,
  onInstall,
  onLoadMore,
}: McpMarketplacePanelProps) {
  return (
    <div className="min-h-0">
      <div className="px-5 py-4">
        <div className="text-sm font-medium text-text-primary">{labels.title}</div>
        {sourceUrl ? (
          <div className="mt-2 break-all text-xs text-text-tertiary">
            {labels.activeSource}: {sourceUrl}
          </div>
        ) : null}
        {cacheInfo?.stale ? (
          <div className="mt-2 text-xs text-amber-700">
            {labels.cachedResult}
            {cacheInfo.cachedAt ? ` (${cacheInfo.cachedAt})` : ""}
          </div>
        ) : null}
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
          {servers.map((server) => (
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
                  <div className="mt-2 text-sm leading-6 text-text-secondary">
                    {server.description || server.name}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-text-tertiary">{labels.transports}</span>
                    {server.transports.length > 0 ? (
                      server.transports.map((transport, index) => (
                        <Badge key={`${server.id}-${formatTransport(transport)}-${index}`} variant="muted">
                          {formatTransport(transport)}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="muted">unknown</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onInstall(server)}
                  disabled={server.transports.length === 0 || !server.transports.some((item) => item.installable)}
                  title={formatTransportSummary(server)}
                >
                  <Download className="h-4 w-4" />
                  {server.transports.some((item) => item.installable) ? labels.install : "暂不支持"}
                </Button>
              </div>
            </div>
          ))}

          {hasMore ? (
            <div className="flex justify-center px-5 py-4">
              <Button variant="secondary" size="sm" onClick={onLoadMore} disabled={isLoading}>
                {isLoading && !isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isLoading && !isSearching ? labels.loading : labels.loadMore}
              </Button>
            </div>
          ) : null}
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
    </div>
  );
}
