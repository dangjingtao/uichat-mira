import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { PackageCheck, RefreshCw, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import Alert from "@/shared/ui/Alert";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import SegmentedTabs from "@/shared/ui/SegmentedTabs";
import { Button } from "@/shared/ui/Button";
import { TextInput } from "@/shared/ui/Input";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import {
  connectExternalMcpServer,
  createExternalMcpServer,
  deleteExternalMcpServer,
  discoverExternalMcpServer,
  getExternalMcpServerConfig,
  getExternalMcpServerConfigSchema,
  getExternalMcpServers,
  getMcpMarketplaceServers,
  updateExternalMcpServerConfig,
  type ExternalMcpConfigSchemaResolution,
  type ExternalMcpServerConfigRecord,
  type ExternalMcpServerRecord,
  type McpMarketplaceServer,
} from "@/shared/api/tools";
import McpConfigModalContent from "./components/McpConfigModalContent";
import McpGuideDrawer from "./components/McpGuideDrawer";
import McpMarketplacePanel from "./components/McpMarketplacePanel";
import McpInstalledServersPanel from "./components/McpInstalledServersPanel";

type McpTab = "marketplace" | "installed";

type InstallTransportChoice =
  | {
      kind: "streamable-http";
      url: string;
    }
  | {
      kind: "stdio";
      command: string;
      args?: string[];
    };

const isInstallableTransport = (
  transport: McpMarketplaceServer["transports"][number],
): transport is Extract<McpMarketplaceServer["transports"][number], { installable: true }> =>
  transport.installable;

const getMarketplaceTransportDetail = (
  transport: McpMarketplaceServer["transports"][number],
) => {
  if (transport.kind === "streamable-http") {
    return transport.url;
  }

  if (transport.kind === "stdio") {
    return `${transport.command}${transport.args?.length ? ` ${transport.args.join(" ")}` : ""}`;
  }

  return transport.packageIdentifier;
};

const dedupeMarketplaceServers = (servers: McpMarketplaceServer[]) => {
  const seen = new Set<string>();
  const deduped: McpMarketplaceServer[] = [];

  for (const server of servers) {
    if (seen.has(server.id)) {
      continue;
    }
    seen.add(server.id);
    deduped.push(server);
  }

  return deduped;
};

const toFriendlyMcpActionError = (error: unknown, action: "connect" | "discover") => {
  const fallback =
    action === "connect"
      ? "连接 MCP Server 失败"
      : "读取 MCP Server 能力失败";

  const raw = error instanceof Error ? error.message : "";
  if (!raw) {
    return fallback;
  }

  if (raw.includes("找不到 npx")) {
    return "连接失败：当前系统环境里找不到 npx。请确认 Node.js / npm 已正确安装，或把启动命令改成可执行的完整命令。";
  }

  if (raw.includes("找不到 uvx")) {
    return "连接失败：当前系统环境里找不到 uvx。请确认 uv 已安装，或把启动命令改成可执行的完整命令。";
  }

  if (raw.includes("Official MCP marketplace timed out")) {
    return "MCP 市场暂时超时，请稍后重试。";
  }

  if (raw.includes("timed out")) {
    return `连接失败：请求超时。原始错误：${raw}`;
  }

  if (raw.includes("MCP stdio response did not include result")) {
    return "连接失败：本地 MCP 进程已启动，但没有按预期返回初始化结果。请检查该 MCP 包是否兼容当前协议。";
  }

  if (raw.includes("Failed to parse stdio MCP JSON-RPC")) {
    return "连接失败：本地 MCP 进程输出的 JSON 不合法。请检查该 MCP 包是否真的支持 stdio MCP。";
  }

  if (raw.includes("External stdio MCP response")) {
    return "连接失败：本地 MCP 进程输出格式不符合 stdio MCP 协议。";
  }

  return raw.includes("连接失败") ? raw : `${fallback}：${raw}`;
};

export default function McpSettings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<McpTab>("marketplace");
  const [marketplaceServers, setMarketplaceServers] = useState<McpMarketplaceServer[]>([]);
  const [installedServers, setInstalledServers] = useState<ExternalMcpServerRecord[]>([]);
  const [marketplaceQuery, setMarketplaceQuery] = useState("");
  const [committedMarketplaceQuery, setCommittedMarketplaceQuery] = useState("");
  const [installedQuery, setInstalledQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [marketplaceCacheInfo, setMarketplaceCacheInfo] = useState<{
    hit: boolean;
    stale: boolean;
    cachedAt: string | null;
  } | null>(null);
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(false);
  const [isMarketplaceSearching, setIsMarketplaceSearching] = useState(false);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);
  const [isInstalledLoading, setIsInstalledLoading] = useState(false);
  const [installedError, setInstalledError] = useState<string | null>(null);
  const [pendingServerId, setPendingServerId] = useState<string | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const marketplaceRequestControllerRef = useRef<AbortController | null>(null);
  const marketplaceRequestSerialRef = useRef(0);

  const loadServers = useCallback(
    async (options?: {
      append?: boolean;
      cursor?: string | null;
      query?: string;
      silent?: boolean;
    }) => {
      const isSearchRequest = Boolean((options?.query ?? "").trim()) && !options?.append;
      const requestId = ++marketplaceRequestSerialRef.current;

      marketplaceRequestControllerRef.current?.abort();
      const controller = new AbortController();
      marketplaceRequestControllerRef.current = controller;

      if (!options?.silent) {
        setIsMarketplaceLoading(true);
      }
      setIsMarketplaceSearching(isSearchRequest);
      setMarketplaceError(null);
      if (!options?.append) {
        setMarketplaceServers([]);
        setNextCursor(null);
        setMarketplaceCacheInfo(null);
      }

      try {
        const result = await getMcpMarketplaceServers({
          limit: 24,
          cursor: options?.cursor ?? undefined,
          query: options?.query ?? "",
          signal: controller.signal,
        });

        if (requestId !== marketplaceRequestSerialRef.current) {
          return;
        }

        setMarketplaceServers((current) =>
          dedupeMarketplaceServers(options?.append ? [...current, ...result.servers] : result.servers),
        );
        setNextCursor(result.metadata.nextCursor);
        setSourceUrl(result.metadata.sourceUrl);
        setMarketplaceCacheInfo(result.metadata.cache);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        if (requestId !== marketplaceRequestSerialRef.current) {
          return;
        }

        setMarketplaceError(
          loadError instanceof Error
            ? loadError.message
            : t("settings.mcp.messages.marketplaceLoadFailed"),
        );
      } finally {
        if (requestId === marketplaceRequestSerialRef.current) {
          setIsMarketplaceLoading(false);
          setIsMarketplaceSearching(false);
        }
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

  const applyInstall = useCallback(
    async (server: McpMarketplaceServer, transport: InstallTransportChoice) => {
      const matchedStdioTransport =
        transport.kind === "stdio"
          ? server.transports.find(
              (item) =>
                item.kind === "stdio" &&
                item.command === transport.command &&
                JSON.stringify(item.args ?? []) === JSON.stringify(transport.args ?? []),
            )
          : undefined;

      await createExternalMcpServer({
        id: server.id,
        registryUrl: sourceUrl ?? undefined,
        packageName:
          matchedStdioTransport && matchedStdioTransport.kind === "stdio"
            ? matchedStdioTransport.args?.at(-1)
            : undefined,
        documentationUrl: server.websiteUrl ?? undefined,
        repositoryUrl: server.repositoryUrl ?? undefined,
        displayName: server.title,
        description: server.description,
        version: server.version ?? undefined,
        transport,
        disclaimerAccepted: true,
      });
      message.success(t("settings.mcp.messages.installSucceeded"));
      setActiveTab("installed");
      await loadInstalledServers();
    },
    [loadInstalledServers, sourceUrl, t],
  );

  useEffect(() => {
    void loadServers({ query: committedMarketplaceQuery });
    void loadInstalledServers();

    return () => {
      marketplaceRequestControllerRef.current?.abort();
    };
  }, [loadInstalledServers, loadServers]);

  const refreshMarketplace = () =>
    loadServers({ query: committedMarketplaceQuery, cursor: null, append: false });
  const loadMore = () => {
    if (!nextCursor) {
      return;
    }

    void loadServers({ query: committedMarketplaceQuery, cursor: nextCursor, append: true });
  };

  const submitMarketplaceSearch = useCallback(() => {
    const normalizedQuery = marketplaceQuery.trim();
    if (normalizedQuery === committedMarketplaceQuery) {
      void loadServers({ query: normalizedQuery, cursor: null, append: false });
      return;
    }
    void loadServers({ query: normalizedQuery, cursor: null, append: false });
    setCommittedMarketplaceQuery(normalizedQuery);
  }, [committedMarketplaceQuery, loadServers, marketplaceQuery]);

  const installServer = (server: McpMarketplaceServer) => {
    const transports = server.transports;
    const installableTransports = transports.filter(isInstallableTransport);
    if (transports.length === 0 || installableTransports.length === 0) {
      message.error(t("settings.mcp.messages.installUnsupported"));
      return;
    }

    const closeInstallPicker = (key: string) => {
      Modal.close(key);
    };

    const runInstall = async (transport: InstallTransportChoice) => {
      await applyInstall(server, transport);
    };

    if (installableTransports.length === 1) {
      const [transport] = installableTransports;
      void runInstall(
        transport.kind === "streamable-http"
          ? {
              kind: "streamable-http",
              url: transport.url,
            }
          : {
              kind: "stdio",
              command: transport.command ?? "",
              args: transport.args ?? [],
            },
      );
      return;
    }

    const modalKey = Modal.show({
      title: t("settings.mcp.installDialog.title"),
      width: 640,
      footer: null,
      content: (
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-base font-medium text-text-primary">{server.title}</div>
              {server.version ? (
                <span className="rounded-full border border-border bg-surface-secondary px-2 py-0.5 text-[11px] text-text-tertiary">
                  v{server.version}
                </span>
              ) : null}
            </div>
            <div className="text-sm leading-6 text-text-secondary">
              {t("settings.mcp.installDialog.description", {
                name: server.title,
              })}
            </div>
            {server.description ? (
              <div className="rounded-ui-control border border-border bg-surface-secondary px-3 py-2 text-sm leading-6 text-text-secondary">
                {server.description}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            {transports.map((transport) => (
              <button
                key={`${server.id}-${transport.kind}-${getMarketplaceTransportDetail(transport)}`}
                type="button"
                className={`w-full rounded-ui-control border px-4 py-4 text-left transition-colors ${
                  transport.installable
                    ? "border-border bg-surface-primary hover:bg-surface-secondary"
                    : "border-border/70 bg-surface-secondary/40 opacity-80"
                }`}
                onClick={() => {
                  if (!transport.installable) {
                    return;
                  }
                  closeInstallPicker(modalKey);
                  void runInstall(
                    transport.kind === "streamable-http"
                      ? {
                          kind: "streamable-http",
                          url: transport.url,
                        }
                      : {
                          kind: "stdio",
                          command: transport.command ?? "",
                          args: transport.args ?? [],
                        },
                  );
                }}
                disabled={!transport.installable}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {transport.label}
                      </span>
                      <span className="rounded-full border border-border bg-surface-secondary px-2 py-0.5 text-[11px] text-text-tertiary">
                        {transport.packageType}
                      </span>
                    </div>
                    <div className="mt-2 break-all font-mono text-xs text-text-tertiary">
                      {getMarketplaceTransportDetail(transport)}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-text-tertiary">
                    {transport.installable ? t("settings.mcp.marketplace.install") : "暂不支持安装"}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {server.websiteUrl || server.repositoryUrl ? (
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
              {server.websiteUrl ? (
                <a
                  href={server.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-secondary underline underline-offset-4 hover:text-text-primary"
                >
                  Docs
                </a>
              ) : null}
              {server.repositoryUrl ? (
                <a
                  href={server.repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-text-secondary underline underline-offset-4 hover:text-text-primary"
                >
                  GitHub
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
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
      message.error(toFriendlyMcpActionError(actionError, action));
    } finally {
      setPendingServerId(null);
    }
  };

  const removeServer = (server: ExternalMcpServerRecord) => {
    Modal.confirm({
      title: t("settings.mcp.deleteDialog.title"),
      description: t("settings.mcp.deleteDialog.description", {
        name: server.displayName,
      }),
      confirmText: t("settings.mcp.deleteDialog.confirm"),
      tone: "danger",
      onConfirm: async () => {
        await deleteExternalMcpServer(server.id);
        message.success(t("settings.mcp.messages.deleteSucceeded"));
        await loadInstalledServers();
      },
    });
  };

  const openConfig = async (server: ExternalMcpServerRecord) => {
    let modalKey = "";

    const ConfigModalBody = () => {
      const [schema, setSchema] = useState<ExternalMcpConfigSchemaResolution | null>(null);
      const [config, setConfig] = useState<ExternalMcpServerConfigRecord | null>(null);
      const [isLoading, setIsLoading] = useState(true);
      const [isSubmitting, setIsSubmitting] = useState(false);
      const [error, setError] = useState<string | null>(null);

      useEffect(() => {
        let cancelled = false;

        const load = async () => {
          setIsLoading(true);
          setError(null);
          try {
            const [nextSchema, nextConfig] = await Promise.all([
              getExternalMcpServerConfigSchema(server.id),
              getExternalMcpServerConfig(server.id),
            ]);
            if (cancelled) {
              return;
            }
            setSchema(nextSchema);
            setConfig(nextConfig);
          } catch (loadError) {
            if (cancelled) {
              return;
            }
            setError(
              loadError instanceof Error
                ? loadError.message
                : t("settings.mcp.messages.configLoadFailed"),
            );
          } finally {
            if (!cancelled) {
              setIsLoading(false);
            }
          }
        };

        void load();

        return () => {
          cancelled = true;
        };
      }, []);

      if (isLoading) {
        return (
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <RefreshCw className="h-4 w-4 animate-spin" />
              {t("settings.mcp.config.loading")}
            </div>
          </div>
        );
      }

      if (!schema || !config) {
        return (
          <div className="rounded-ui-control border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error ?? t("settings.mcp.messages.configLoadFailed")}
          </div>
        );
      }

      return (
        <McpConfigModalContent
          schema={schema}
          config={config}
          isSubmitting={isSubmitting}
          error={error}
          labels={{
            endpointUrl: t("settings.mcp.config.endpointUrl"),
            bearerToken: t("settings.mcp.config.bearerToken"),
            timeoutMs: t("settings.mcp.config.timeoutMs"),
            customHeadersJson: t("settings.mcp.config.customHeadersJson"),
            cwd: t("settings.mcp.config.cwd"),
            envJson: t("settings.mcp.config.envJson"),
            authType: t("settings.mcp.config.authType"),
            authTypeNone: t("settings.mcp.config.authTypeNone"),
            authTypeBearer: t("settings.mcp.config.authTypeBearer"),
            knownPartial: t("settings.mcp.config.knownPartial"),
            notesTitle: t("settings.mcp.config.notesTitle"),
            cancel: t("settings.mcp.config.cancel"),
            save: t("settings.mcp.config.save"),
            saveLoading: t("settings.mcp.config.saveLoading"),
            clearTokenHint: t("settings.mcp.config.clearTokenHint"),
          }}
          onCancel={() => Modal.close(modalKey)}
          onSubmit={async (input) => {
            setIsSubmitting(true);
            setError(null);
            try {
              const updated = await updateExternalMcpServerConfig(server.id, input);
              setConfig(updated);
              message.success(t("settings.mcp.messages.configSaveSucceeded"));
              Modal.close(modalKey);
              await loadInstalledServers();
            } catch (submitError) {
              setError(
                submitError instanceof Error
                  ? submitError.message
                  : t("settings.mcp.messages.configSaveFailed"),
              );
            } finally {
              setIsSubmitting(false);
            }
          }}
        />
      );
    };

    modalKey = Modal.show({
      title: t("settings.mcp.config.title", { name: server.displayName }),
      width: 640,
      height: 720,
      bodyClassName: "h-full",
      content: <ConfigModalBody />,
      footer: null,
    });
  };

  const tabs = useMemo(
    () => [
      {
        value: "marketplace" as const,
        label: (
          <span className="flex items-center gap-1">
            <Store className="h-3.5 w-3.5" />
            {t("settings.mcp.tabs.marketplace")}
          </span>
        ),
      },
      {
        value: "installed" as const,
        label: (
          <span className="flex items-center gap-1">
            <PackageCheck className="h-3.5 w-3.5" />
            {t("settings.mcp.tabs.installed")}
            <span className="rounded-full bg-surface-secondary px-1.5 py-0 text-[10px] leading-4 text-text-tertiary">
              {installedServers.length}
            </span>
          </span>
        ),
      },
    ],
    [installedServers.length, t],
  );

  const activeQuery = activeTab === "marketplace" ? marketplaceQuery : installedQuery;
  const setActiveQuery = activeTab === "marketplace" ? setMarketplaceQuery : setInstalledQuery;
  const filteredInstalledServers = useMemo(() => {
    const keyword = installedQuery.trim().toLowerCase();
    if (!keyword) {
      return installedServers;
    }

    return installedServers.filter((server) => {
      const haystacks = [
        server.id,
        server.displayName,
        server.description ?? "",
        server.transport.kind === "streamable-http"
          ? server.transport.url
          : `${server.transport.command} ${(server.transport.args ?? []).join(" ")}`,
        ...server.discoveredTools.map((tool) => `${tool.title} ${tool.projectedCapabilityId}`),
      ];
      return haystacks.some((value) => value.toLowerCase().includes(keyword));
    });
  }, [installedQuery, installedServers]);

  const activeError = activeTab === "marketplace" ? marketplaceError : installedError;
  const activeLoading = activeTab === "marketplace" ? isMarketplaceLoading : isInstalledLoading;
  const activeSearchPlaceholder =
    activeTab === "marketplace"
      ? t("settings.mcp.marketplace.searchPlaceholder")
      : t("settings.mcp.installed.searchPlaceholder");

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (activeTab !== "marketplace") {
      return;
    }
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    submitMarketplaceSearch();
  };

  const handleRefresh = () => {
    if (activeTab === "marketplace") {
      void refreshMarketplace();
      return;
    }
    void loadInstalledServers();
  };

  const handleSearchSubmit = () => {
    if (activeTab !== "marketplace") {
      return;
    }
    submitMarketplaceSearch();
  };

  return (
    <SettingsPageLayout
      miniTitle={t("settings.mcp.miniTitle")}
      title={t("settings.mcp.title")}
      description={t("settings.mcp.description")}
      contentClassName="h-full min-h-0 pt-6"
      scrollBody={false}
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-ui-panel border border-border bg-surface-primary shadow-shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedTabs
              items={tabs}
              value={activeTab}
              onChange={setActiveTab}
              size="sm"
            />
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="min-w-[220px] flex-1">
                <TextInput
                  value={activeQuery}
                  onChange={setActiveQuery}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={activeSearchPlaceholder}
                  compact
                />
              </div>
              {activeTab === "marketplace" ? (
                <Button variant="secondary" size="sm" onClick={handleSearchSubmit}>
                  {t("settings.mcp.marketplace.search")}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={activeLoading}>
                <RefreshCw className={`h-4 w-4 ${activeLoading ? "animate-spin" : ""}`} />
                {t("settings.mcp.installed.refresh")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsGuideOpen(true)}>
                {t("settings.mcp.guide.open")}
              </Button>
            </div>
          </div>
        </div>

        {activeError ? (
          <div className="border-b border-border px-5 py-4">
            <Alert
              variant="warning"
              title={activeError}
              action={
                <Button variant="outline" size="xs" onClick={handleRefresh} disabled={activeLoading}>
                  {t("settings.mcp.marketplace.retry")}
                </Button>
              }
            />
          </div>
        ) : null}

        <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto">
          {activeTab === "marketplace" ? (
            <McpMarketplacePanel
              hasMore={Boolean(nextCursor)}
              isLoading={isMarketplaceLoading}
              isSearching={isMarketplaceSearching}
              servers={marketplaceServers}
              sourceUrl={sourceUrl}
              cacheInfo={marketplaceCacheInfo}
              labels={{
                activeSource: t("settings.mcp.marketplace.activeSource"),
                cachedResult: "官方 MCP 市场暂时不可用，当前显示最近一次成功结果",
                emptyDescription: t("settings.mcp.marketplace.emptyDescription"),
                emptyTitle: t("settings.mcp.marketplace.emptyTitle"),
                install: t("settings.mcp.marketplace.install"),
                loadMore: t("settings.mcp.marketplace.loadMore"),
                loading: t("settings.mcp.marketplace.loading"),
                title: t("settings.mcp.marketplace.title"),
                transports: t("settings.mcp.marketplace.transports"),
              }}
              onInstall={installServer}
              onLoadMore={loadMore}
            />
          ) : (
            <McpInstalledServersPanel
              pendingServerId={pendingServerId}
              servers={filteredInstalledServers}
              labels={{
                title: t("settings.mcp.installed.title"),
                emptyTitle: t("settings.mcp.installed.emptyTitle"),
                emptyDescription: t("settings.mcp.installed.emptyDescription"),
                configure: t("settings.mcp.installed.configure"),
                connect: t("settings.mcp.installed.connect"),
                discover: t("settings.mcp.installed.discover"),
                remove: t("settings.mcp.installed.remove"),
                discovered: t("settings.mcp.installed.discovered"),
                connected: t("settings.mcp.installed.connected"),
                configured: t("settings.mcp.installed.configured"),
                failed: t("settings.mcp.installed.failed"),
                protocol: t("settings.mcp.installed.protocol"),
                endpoint: t("settings.mcp.installed.endpoint"),
                remote: t("settings.mcp.installed.remote"),
                capabilities: t("settings.mcp.installed.capabilities"),
                tools: t("settings.mcp.installed.tools"),
                resources: t("settings.mcp.installed.resources"),
                prompts: t("settings.mcp.installed.prompts"),
                projectedId: t("settings.mcp.installed.projectedId"),
                discoveredToolsSummary: "已发现",
                docs: "Docs",
                repository: "GitHub",
                packageName: "Package",
              }}
              onConfigure={(server) => void openConfig(server)}
              onConnect={(serverId) => void runServerAction(serverId, "connect")}
              onDiscover={(serverId) => void runServerAction(serverId, "discover")}
              onDelete={removeServer}
            />
          )}
        </div>
      </div>

      <McpGuideDrawer
        open={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        labels={{
          title: t("settings.mcp.guide.title"),
          intro: t("settings.mcp.guide.intro"),
          searchTitle: t("settings.mcp.guide.sections.search.title"),
          searchBody: t("settings.mcp.guide.sections.search.body"),
          installTitle: t("settings.mcp.guide.sections.install.title"),
          installBody: t("settings.mcp.guide.sections.install.body"),
          configTitle: t("settings.mcp.guide.sections.config.title"),
          configBody: t("settings.mcp.guide.sections.config.body"),
          connectTitle: t("settings.mcp.guide.sections.connect.title"),
          connectBody: t("settings.mcp.guide.sections.connect.body"),
          discoverTitle: t("settings.mcp.guide.sections.discover.title"),
          discoverBody: t("settings.mcp.guide.sections.discover.body"),
          inspectTitle: t("settings.mcp.guide.sections.inspect.title"),
          inspectBody: t("settings.mcp.guide.sections.inspect.body"),
          boundaryTitle: t("settings.mcp.guide.sections.boundary.title"),
          boundaryBody: t("settings.mcp.guide.sections.boundary.body"),
          officialSourceTitle: t("settings.mcp.guide.sections.officialSource.title"),
          officialSourceBody: t("settings.mcp.guide.sections.officialSource.body"),
          close: t("settings.mcp.guide.close"),
          searchHint: t("settings.mcp.guide.searchHint"),
        }}
      />
    </SettingsPageLayout>
  );
}
