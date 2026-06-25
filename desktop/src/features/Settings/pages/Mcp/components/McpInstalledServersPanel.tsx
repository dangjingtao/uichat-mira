import { Loader2, PlugZap, RefreshCw, Radar } from "lucide-react";
import Alert from "@/shared/ui/Alert";
import Badge from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import type { ExternalMcpServerRecord } from "@/shared/api/tools";

type McpInstalledServersPanelProps = {
  error: string | null;
  isLoading: boolean;
  servers: ExternalMcpServerRecord[];
  pendingServerId: string | null;
  labels: {
    title: string;
    description: string;
    emptyTitle: string;
    emptyDescription: string;
    refresh: string;
    connect: string;
    discover: string;
    discovered: string;
    connected: string;
    configured: string;
    failed: string;
    protocol: string;
    endpoint: string;
    projectedId: string;
    retry: string;
  };
  onConnect: (serverId: string) => void;
  onDiscover: (serverId: string) => void;
  onRefresh: () => void;
};

const getStatusLabel = (
  server: ExternalMcpServerRecord,
  labels: McpInstalledServersPanelProps["labels"],
) => {
  switch (server.status) {
    case "connected":
      return labels.connected;
    case "failed":
      return labels.failed;
    default:
      return labels.configured;
  }
};

export default function McpInstalledServersPanel({
  error,
  isLoading,
  servers,
  pendingServerId,
  labels,
  onConnect,
  onDiscover,
  onRefresh,
}: McpInstalledServersPanelProps) {
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

      {!error && servers.length === 0 ? (
        <div className="px-4 py-8">
          <div className="text-sm font-medium text-text-primary">{labels.emptyTitle}</div>
          <div className="mt-1 text-sm text-text-secondary">{labels.emptyDescription}</div>
        </div>
      ) : null}

      {!error && servers.length > 0 ? (
        <div className="divide-y divide-border">
          {servers.map((server) => {
            const isPending = pendingServerId === server.id;
            return (
              <div key={server.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-sm font-medium text-text-primary">
                        {server.displayName}
                      </div>
                      <Badge variant="muted">{getStatusLabel(server, labels)}</Badge>
                      {server.discoveredTools.length > 0 ? (
                        <Badge variant="success">
                          {labels.discovered}: {server.discoveredTools.length}
                        </Badge>
                      ) : null}
                      {server.protocolVersion ? (
                        <Badge variant="muted">
                          {labels.protocol}: {server.protocolVersion}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-1 break-all text-xs text-text-tertiary">{server.id}</div>

                    {server.description ? (
                      <div className="mt-2 text-sm leading-6 text-text-secondary">
                        {server.description}
                      </div>
                    ) : null}

                    <div className="mt-3 text-xs text-text-tertiary">
                      {labels.endpoint}: {server.transport.url}
                    </div>

                    {server.lastError ? (
                      <div className="mt-3 rounded-ui-control border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger">
                        {server.lastError}
                      </div>
                    ) : null}

                    {server.discoveredTools.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {server.discoveredTools.map((tool) => (
                          <div
                            key={`${server.id}-${tool.projectedCapabilityId}`}
                            className="rounded-ui-control border border-border bg-surface-secondary px-3 py-2"
                          >
                            <div className="text-xs font-medium text-text-primary">
                              {tool.title}
                            </div>
                            <div className="mt-1 break-all text-xs text-text-tertiary">
                              {labels.projectedId}: {tool.projectedCapabilityId}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => onConnect(server.id)}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                      {labels.connect}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isPending}
                      onClick={() => onDiscover(server.id)}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                      {labels.discover}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
