import { Download } from "lucide-react";
import Badge from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import type { McpMarketplaceServer } from "@/shared/api/tools";

type McpMarketplacePanelProps = {
  hasMore: boolean;
  isLoading: boolean;
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
    title: string;
    transports: string;
  };
  onInstall: (server: McpMarketplaceServer) => void;
  onLoadMore: () => void;
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
  hasMore,
  isLoading,
  servers,
  sourceUrl,
  labels,
  onInstall,
  onLoadMore,
}: McpMarketplacePanelProps) {
  return (
    <div className="min-h-0">
      <div className="px-5 py-4">
        <div className="text-sm font-medium text-text-primary">{labels.title}</div>
        <div className="mt-1 text-sm text-text-secondary">{labels.description}</div>
        {sourceUrl ? (
          <div className="mt-3 break-all text-xs text-text-tertiary">
            {labels.activeSource}: {sourceUrl}
          </div>
        ) : null}
      </div>

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
            <div className="flex justify-center px-5 py-4">
              <Button variant="secondary" size="sm" onClick={onLoadMore} disabled={isLoading}>
                {isLoading ? labels.loading : labels.loadMore}
              </Button>
            </div>
          ) : null}
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
