import { Download, RefreshCw, Search } from "lucide-react";
import Alert from "@/shared/ui/Alert";
import Badge from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { TextInput } from "@/shared/ui/Input";
import type { McpMarketplaceServer } from "@/shared/api/tools";

type McpMarketplacePanelProps = {
  error: string | null;
  hasMore: boolean;
  isLoading: boolean;
  query: string;
  servers: McpMarketplaceServer[];
  sourceUrl: string | null;
  labels: {
    activeSource: string;
    description: string;
    emptyDescription: string;
    emptyTitle: string;
    install: string;
    loadMore: string;
    loading: string;
    refresh: string;
    retry: string;
    search: string;
    searchPlaceholder: string;
    title: string;
    transports: string;
  };
  onInstall: (server: McpMarketplaceServer) => void;
  onLoadMore: () => void;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onSearch: () => void;
};

function formatTransport(transport: McpMarketplaceServer["transports"][number]) {
  if (transport.kind === "streamable-http") {
    return "streamable-http";
  }

  return `stdio · ${transport.command}`;
}

function formatTransportSummary(server: McpMarketplaceServer) {
  if (server.transports.length === 0) {
    return "unknown";
  }

  return server.transports.map(formatTransport).join(", ");
}

export default function McpMarketplacePanel({
  error,
  hasMore,
  isLoading,
  query,
  servers,
  sourceUrl,
  labels,
  onInstall,
  onLoadMore,
  onQueryChange,
  onRefresh,
  onSearch,
}: McpMarketplacePanelProps) {
  return (
    <div className="rounded-ui-panel border border-border bg-surface-primary">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-text-primary">{labels.title}</div>
            <div className="mt-1 text-sm text-text-secondary">{labels.description}</div>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            {labels.refresh}
          </Button>
        </div>

        <form
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
        >
          <TextInput
            value={query}
            onChange={onQueryChange}
            placeholder={labels.searchPlaceholder}
            disabled={isLoading}
            compact
          />
          <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
            <Search className="h-4 w-4" />
            {labels.search}
          </Button>
        </form>

        {sourceUrl ? (
          <div className="mt-3 break-all text-xs text-text-tertiary">
            {labels.activeSource}: {sourceUrl}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="p-4">
          <Alert
            variant="warning"
            title={error}
            action={
              <Button variant="outline" size="xs" onClick={onRefresh} disabled={isLoading}>
                {labels.retry}
              </Button>
            }
          />
        </div>
      ) : null}

      {!error && servers.length > 0 ? (
        <div className="divide-y divide-border">
          {servers.map((server) => (
            <div key={server.id} className="px-4 py-3">
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
                  disabled={isLoading || !server.transports.some((item) => item.kind === "streamable-http")}
                  title={formatTransportSummary(server)}
                >
                  <Download className="h-4 w-4" />
                  {labels.install}
                </Button>
              </div>
            </div>
          ))}

          {hasMore ? (
            <div className="flex justify-center px-4 py-4">
              <Button variant="secondary" size="sm" onClick={onLoadMore} disabled={isLoading}>
                {isLoading ? labels.loading : labels.loadMore}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      {!error && servers.length === 0 ? (
        <div className="px-4 py-8">
          <div className="text-sm font-medium text-text-primary">{labels.emptyTitle}</div>
          <div className="mt-1 text-sm text-text-secondary">
            {isLoading ? labels.loading : labels.emptyDescription}
          </div>
        </div>
      ) : null}
    </div>
  );
}
