import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Info, PackageCheck, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import Alert from "@/shared/ui/Alert";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import SegmentedTabs from "@/shared/ui/SegmentedTabs";
import { Button } from "@/shared/ui/Button";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import {
  connectExternalMcpServer,
  createExternalMcpServer,
  discoverExternalMcpServer,
  getExternalMcpServers,
  getMcpMarketplaceServers,
  type ExternalMcpServerRecord,
  type McpMarketplaceServer,
} from "@/shared/api/tools";
import McpMarketplacePanel from "./components/McpMarketplacePanel";
import McpInstalledServersPanel from "./components/McpInstalledServersPanel";

type McpTab = "marketplace" | "installed";

export default function McpSettings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<McpTab>("marketplace");
  const [marketplaceServers, setMarketplaceServers] = useState<McpMarketplaceServer[]>([]);
  const [installedServers, setInstalledServers] = useState<ExternalMcpServerRecord[]>([]);
  const [query, setQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [isInstalledLoading, setIsInstalledLoading] = useState(false);
  const [installedError, setInstalledError] = useState<string | null>(null);
  const [pendingServerId, setPendingServerId] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);

  const loadServers = useCallback(
    async (options?: { append?: boolean; cursor?: string | null; query?: string }) => {
      setIsMarketplaceLoading(true);
      setMarketplaceError(null);

      try {
        const result = await getMcpMarketplaceServers({
          limit: 24,
          cursor: options?.cursor ?? undefined,
          query: options?.query ?? "",
        });

        setMarketplaceServers((current) =>
          options?.append ? [...current, ...result.servers] : result.servers,
        );
        setNextCursor(result.metadata.nextCursor);
        setSourceUrl(result.metadata.sourceUrl);
      } catch (loadError) {
        setMarketplaceError(
          loadError instanceof Error
            ? loadError.message
            : t("settings.mcp.messages.marketplaceLoadFailed"),
        );
      } finally {
        setIsMarketplaceLoading(false);
      }
    },
    [t],
  );

  const loadInstalledServers = useCallback(async () => {
    setIsInstalledLoading(true);
    setInstalledError(null);
    try {
      const result = await getExternalMcpServers();
      setInstalledServers(result);
    } catch (loadError) {
      setInstalledError(
        loadError instanceof Error ? loadError.message : t("settings.mcp.messages.installedLoadFailed"),
      );
    } finally {
      setIsInstalledLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadServers({ query: "" });
    void loadInstalledServers();
  }, [loadInstalledServers, loadServers]);

  const refresh = () => loadServers({ query, cursor: null, append: false });
  const search = () => loadServers({ query, cursor: null, append: false });
  const loadMore = () => {
    if (!nextCursor) {
      return;
    }

    void loadServers({ query, cursor: nextCursor, append: true });
  };

  const installServer = (server: McpMarketplaceServer) => {
    const transport = server.transports.find((item) => item.kind === "streamable-http");
    if (!transport || transport.kind !== "streamable-http") {
      message.error(t("settings.mcp.messages.installUnsupported"));
      return;
    }

    Modal.confirm({
      title: t("settings.mcp.installDialog.title"),
      description: t("settings.mcp.installDialog.description", {
        name: server.title,
      }),
      confirmText: t("settings.mcp.installDialog.confirm"),
      onConfirm: async () => {
        await createExternalMcpServer({
          id: server.id,
          registryUrl: sourceUrl ?? undefined,
          displayName: server.title,
          description: server.description,
          version: server.version ?? undefined,
          transport: {
            kind: "streamable-http",
            url: transport.url,
          },
          disclaimerAccepted: true,
        });
        message.success(t("settings.mcp.messages.installSucceeded"));
        setActiveTab("installed");
        await loadInstalledServers();
      },
    });
  };

  const runServerAction = async (
    serverId: string,
    action: "connect" | "discover",
  ) => {
    setPendingServerId(serverId);
    try {
      if (action === "connect") {
        await connectExternalMcpServer(serverId);
        message.success(t("settings.mcp.messages.connectSucceeded"));
      } else {
        await discoverExternalMcpServer(serverId);
        message.success(t("settings.mcp.messages.discoverSucceeded"));
      }
      await loadInstalledServers();
    } catch (actionError) {
      message.error(
        actionError instanceof Error
          ? actionError.message
          : action === "connect"
            ? t("settings.mcp.messages.connectFailed")
            : t("settings.mcp.messages.discoverFailed"),
      );
    } finally {
      setPendingServerId(null);
    }
  };

  const tabs = useMemo(
    () => [
      {
        value: "marketplace" as const,
        label: (
          <span className="flex items-center gap-1.5">
            <Store className="h-4 w-4" />
            {t("settings.mcp.tabs.marketplace")}
          </span>
        ),
      },
      {
        value: "installed" as const,
        label: (
          <span className="flex items-center gap-1.5">
            <PackageCheck className="h-4 w-4" />
            {t("settings.mcp.tabs.installed")}
            <span className="rounded-full bg-surface-secondary px-1.5 py-0.5 text-[10px] text-text-tertiary">
              {installedServers.length}
            </span>
          </span>
        ),
      },
    ],
    [installedServers.length, t],
  );

  return (
    <SettingsPageLayout
      miniTitle={t("settings.mcp.miniTitle")}
      title={t("settings.mcp.title")}
      description={t("settings.mcp.description")}
      contentClassName="space-y-4 pt-6"
    >
      <div className="sticky top-0 z-10 rounded-ui-panel border border-border bg-surface-primary/95 px-4 py-3 shadow-shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs items={tabs} value={activeTab} onChange={setActiveTab} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowNotes((current) => !current)}
          >
            <Info className="h-4 w-4" />
            {t("settings.mcp.notes.toggle")}
            {showNotes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {showNotes ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Alert variant="info" title={t("settings.mcp.notes.boundaryTitle")}>
              {t("settings.mcp.notes.boundaryDescription")}
            </Alert>
            <Alert variant="warning" title={t("settings.mcp.notes.disclaimerTitle")}>
              {t("settings.mcp.notes.disclaimerDescription")}
            </Alert>
          </div>
        ) : null}
      </div>

      {activeTab === "marketplace" ? (
        <McpMarketplacePanel
          error={marketplaceError}
          hasMore={Boolean(nextCursor)}
          isLoading={isMarketplaceLoading}
          query={query}
          servers={marketplaceServers}
          sourceUrl={sourceUrl}
          labels={{
            activeSource: t("settings.mcp.marketplace.activeSource"),
            description: t("settings.mcp.marketplace.description"),
            emptyDescription: t("settings.mcp.marketplace.emptyDescription"),
            emptyTitle: t("settings.mcp.marketplace.emptyTitle"),
            install: t("settings.mcp.marketplace.install"),
            loadMore: t("settings.mcp.marketplace.loadMore"),
            loading: t("settings.mcp.marketplace.loading"),
            refresh: t("settings.mcp.marketplace.refresh"),
            retry: t("settings.mcp.marketplace.retry"),
            search: t("settings.mcp.marketplace.search"),
            searchPlaceholder: t("settings.mcp.marketplace.searchPlaceholder"),
            title: t("settings.mcp.marketplace.title"),
            transports: t("settings.mcp.marketplace.transports"),
          }}
          onInstall={installServer}
          onLoadMore={loadMore}
          onQueryChange={setQuery}
          onRefresh={() => void refresh()}
          onSearch={() => void search()}
        />
      ) : (
        <McpInstalledServersPanel
          error={installedError}
          isLoading={isInstalledLoading}
          pendingServerId={pendingServerId}
          servers={installedServers}
          labels={{
            title: t("settings.mcp.installed.title"),
            description: t("settings.mcp.installed.description"),
            emptyTitle: t("settings.mcp.installed.emptyTitle"),
            emptyDescription: t("settings.mcp.installed.emptyDescription"),
            refresh: t("settings.mcp.installed.refresh"),
            connect: t("settings.mcp.installed.connect"),
            discover: t("settings.mcp.installed.discover"),
            discovered: t("settings.mcp.installed.discovered"),
            connected: t("settings.mcp.installed.connected"),
            configured: t("settings.mcp.installed.configured"),
            failed: t("settings.mcp.installed.failed"),
            protocol: t("settings.mcp.installed.protocol"),
            endpoint: t("settings.mcp.installed.endpoint"),
            projectedId: t("settings.mcp.installed.projectedId"),
            retry: t("settings.mcp.installed.retry"),
          }}
          onConnect={(serverId) => void runServerAction(serverId, "connect")}
          onDiscover={(serverId) => void runServerAction(serverId, "discover")}
          onRefresh={() => void loadInstalledServers()}
        />
      )}
    </SettingsPageLayout>
  );
}
