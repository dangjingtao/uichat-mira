import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy,
  ExternalLink,
  Github,
  KeyRound,
  LoaderCircle,
  RefreshCcw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import { Button } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  disconnectGitHub,
  getGitHubConnection,
  getGitHubRepositories,
  pollGitHubDeviceFlow,
  startGitHubDeviceFlow,
  validateGitHubConnection,
  type GitHubConnectionResponse,
  type GitHubDeviceFlow,
  type GitHubInstallation,
} from "@/shared/api/github";
import { openExternalUrl } from "@/shared/platform/desktopRuntime";
import MicroAppPageLayout from "../components/MicroAppPageLayout";

const statusText: Record<GitHubConnectionResponse["connection"]["status"], string> = {
  unconfigured: "未连接",
  authorizing: "等待授权",
  connected: "已连接",
  error: "连接异常",
  disabled: "已停用",
};

const statusVariant = (
  status: GitHubConnectionResponse["connection"]["status"],
): "success" | "danger" | "muted" =>
  status === "connected" ? "success" : status === "error" ? "danger" : "muted";

export default function GitHubMicroAppPage() {
  const [connection, setConnection] = useState<GitHubConnectionResponse | null>(null);
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [repositoryCount, setRepositoryCount] = useState(0);
  const [deviceFlow, setDeviceFlow] = useState<GitHubDeviceFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  const stopPolling = useCallback(() => {
    pollingRef.current = false;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const loadRepositories = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getGitHubRepositories();
      setInstallations(result.installations);
      setRepositoryCount(result.repositoryCount);
    } catch (error) {
      setInstallations([]);
      setRepositoryCount(0);
      message.error(error instanceof Error ? error.message : "加载 GitHub 仓库失败");
    } finally {
      setRefreshing(false);
    }
  }, []);

  const applyConnection = useCallback((result: GitHubConnectionResponse) => {
    setConnection(result);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getGitHubConnection();
      applyConnection(result);
      if (result.connection.status === "connected") {
        await loadRepositories();
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载 GitHub 微应用失败");
    } finally {
      setLoading(false);
    }
  }, [applyConnection, loadRepositories]);

  useEffect(() => {
    void load();
    return stopPolling;
  }, [load, stopPolling]);

  const pollAuthorization = useCallback(
    async (flow: GitHubDeviceFlow, delaySeconds = flow.intervalSeconds) => {
      pollingRef.current = true;
      pollTimerRef.current = setTimeout(async () => {
        if (!pollingRef.current) return;
        try {
          const result = await pollGitHubDeviceFlow(flow.flowId);
          if (result.status === "pending") {
            void pollAuthorization(flow, result.intervalSeconds ?? delaySeconds);
            return;
          }
          stopPolling();
          setConnecting(false);
          setDeviceFlow(null);
          if (result.status === "connected" && result.connection) {
            applyConnection({
              connection: result.connection,
              installUrl: result.installUrl ?? null,
            });
            message.success("GitHub 已连接");
            await loadRepositories();
            return;
          }
          message.error(
            result.errorMessage ||
              (result.status === "expired"
                ? "授权码已过期，请重新连接"
                : result.status === "denied"
                  ? "GitHub 授权已取消"
                  : "GitHub 授权失败"),
          );
          await load();
        } catch (error) {
          stopPolling();
          setConnecting(false);
          message.error(error instanceof Error ? error.message : "轮询 GitHub 授权失败");
        }
      }, Math.max(delaySeconds, 5) * 1000);
    },
    [applyConnection, load, loadRepositories, stopPolling],
  );

  const beginConnection = async () => {
    setConnecting(true);
    stopPolling();
    try {
      const flow = await startGitHubDeviceFlow();
      setDeviceFlow(flow);

      try {
        await navigator.clipboard?.writeText(flow.userCode);
      } catch {
        // Clipboard access may be unavailable; the code remains visible in Mira.
      }

      try {
        await openExternalUrl(flow.verificationUri);
      } catch {
        message.error("无法自动打开系统浏览器，请点击下方“打开授权页”");
      }

      void pollAuthorization(flow);
    } catch (error) {
      setConnecting(false);
      message.error(error instanceof Error ? error.message : "启动 GitHub 授权失败");
    }
  };

  const validateConnection = async () => {
    setRefreshing(true);
    try {
      const result = await validateGitHubConnection();
      applyConnection(result);
      await loadRepositories();
      message.success("GitHub 连接有效");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "GitHub 连接验证失败");
    } finally {
      setRefreshing(false);
    }
  };

  const disconnect = async () => {
    stopPolling();
    setConnecting(false);
    setDeviceFlow(null);
    try {
      const result = await disconnectGitHub();
      applyConnection(result);
      setInstallations([]);
      setRepositoryCount(0);
      message.success("已断开 GitHub");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "断开 GitHub 失败");
    }
  };

  const copyCode = async () => {
    if (!deviceFlow) return;
    try {
      await navigator.clipboard.writeText(deviceFlow.userCode);
      message.success("授权码已复制");
    } catch {
      message.error("复制授权码失败");
    }
  };

  const connected = connection?.connection.status === "connected";
  const configured = Boolean(
    connection?.connection.clientId && connection?.connection.appSlug,
  );

  return (
    <MicroAppPageLayout
      miniTitle="Micro Apps"
      title="GitHub"
      description="连接 GitHub，选择 Mira 可以使用的项目。仓库权限由 GitHub 官方授权管理。"
      contentClassName="space-y-5 pt-5"
      slot={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {connected ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void validateConnection()}
                disabled={refreshing}
              >
                <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                验证连接
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void disconnect()}>
                <Unplug className="h-4 w-4" />
                断开
              </Button>
            </>
          ) : null}
        </div>
      }
    >
      <Card className="border-primary/20 bg-primary/5 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-ui-panel bg-surface-primary text-text-primary shadow-shadow-sm">
            {connection?.connection.avatarUrl ? (
              <img
                src={connection.connection.avatarUrl}
                alt="GitHub avatar"
                className="h-14 w-14 rounded-ui-panel object-cover"
              />
            ) : (
              <Github className="h-7 w-7" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-text-primary">
                {connection?.connection.login || "GitHub 尚未连接"}
              </h2>
              <Badge variant={statusVariant(connection?.connection.status ?? "unconfigured")}>
                {statusText[connection?.connection.status ?? "unconfigured"]}
              </Badge>
            </div>
            <p className="text-sm leading-6 text-text-secondary">
              你可以在 GitHub 中选择个人账号或组织，并随时调整 Mira 能访问的项目。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-5 border-t border-border pt-4 text-left md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <Metric label="账号 / 组织" value={String(installations.length)} />
            <Metric label="已授权项目" value={String(repositoryCount)} />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6 text-sm text-text-secondary">正在加载 GitHub 微应用...</Card>
      ) : (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            {!connected ? (
              <Card className="p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-5 w-5 text-icon-secondary" />
                    <div>
                      <h3 className="font-semibold text-text-primary">连接 GitHub</h3>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">
                        Mira 会打开系统浏览器。登录后，由 GitHub 引导你选择账号、组织和项目范围。
                      </p>
                      {!configured ? (
                        <p className="mt-2 text-xs leading-5 text-danger">
                          当前开发版本尚未配置 GitHub 连接服务。
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => void beginConnection()}
                    disabled={connecting || !configured}
                  >
                    {connecting ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Github className="h-4 w-4" />
                    )}
                    {connecting ? "等待授权" : "连接 GitHub"}
                  </Button>
                </div>

                {deviceFlow ? (
                  <div className="mt-5 rounded-ui-panel border border-primary/20 bg-primary/5 p-4">
                    <div className="text-sm font-medium text-text-primary">
                      已打开 GitHub，请输入这个授权码
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <code className="rounded-ui-control border border-border bg-surface-primary px-4 py-2 text-lg font-semibold tracking-[0.18em] text-text-primary">
                        {deviceFlow.userCode}
                      </code>
                      <Button variant="ghost" size="sm" onClick={() => void copyCode()}>
                        <Copy className="h-4 w-4" />复制
                      </Button>
                      <a
                        href={deviceFlow.verificationUri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        重新打开授权页 <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-text-secondary">
                      授权完成后无需手动刷新，Mira 会自动接收结果。
                    </p>
                  </div>
                ) : null}
              </Card>
            ) : (
              <Card padding="none">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
                  <div>
                    <h3 className="font-semibold text-text-primary">已授权项目</h3>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      这里只显示你在 GitHub 中明确授权给 Mira 的仓库。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {connection?.installUrl ? (
                      <a
                        href={connection.installUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-2 rounded-ui-control border border-primary/20 px-3 text-sm font-medium text-primary hover:bg-primary/10"
                      >
                        选择项目 <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void loadRepositories()}
                      disabled={refreshing}
                    >
                      <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                      刷新
                    </Button>
                  </div>
                </div>

                {installations.length === 0 ? (
                  <div className="p-8 text-center">
                    <ShieldCheck className="mx-auto h-8 w-8 text-icon-secondary" />
                    <div className="mt-3 font-medium text-text-primary">还没有授权项目</div>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                      点击“选择项目”，在 GitHub 中选择个人账号或组织，再勾选允许 Mira 使用的仓库。
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {installations.map((installation) => (
                      <InstallationCard key={installation.id} installation={installation} />
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>

          <div className="space-y-5">
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-icon-secondary" />
                <div>
                  <h3 className="font-semibold text-text-primary">项目由你决定</h3>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-text-secondary">
                    <p>GitHub 负责执行项目权限边界。你移除某个项目后，Mira 将不再能访问它。</p>
                    <p>组织项目可能需要组织管理员批准，这是 GitHub 的安全策略。</p>
                  </div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold text-text-primary">连接后可以做什么</h3>
              <div className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
                <p>查看仓库、Issue、Pull Request 与 Actions 状态。</p>
                <p>涉及创建、修改或执行的操作，仍会遵循 Mira 的权限和确认策略。</p>
              </div>
            </Card>
          </div>
        </div>
      )}
    </MicroAppPageLayout>
  );
}

function InstallationCard({ installation }: { installation: GitHubInstallation }) {
  return (
    <section className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {installation.account.avatarUrl ? (
            <img
              src={installation.account.avatarUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
              <Github className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-text-primary">{installation.account.login}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="muted">
                {installation.repositorySelection === "selected" ? "指定项目" : "全部项目"}
              </Badge>
              <span className="text-xs text-text-secondary">
                {installation.repositories.length} 个仓库
              </span>
            </div>
          </div>
        </div>
        <a
          href={installation.manageUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          调整项目 <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {installation.repositories.map((repository) => (
          <a
            key={repository.id}
            href={repository.htmlUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-ui-panel border border-border p-3 transition-colors hover:bg-surface-secondary/50"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-text-primary">
                {repository.fullName}
              </span>
              {repository.private ? <Badge variant="muted">Private</Badge> : null}
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              默认分支：{repository.defaultBranch || "-"}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-text-secondary">{label}</div>
      <div className="mt-1 text-lg font-semibold text-text-primary">{value}</div>
    </div>
  );
}
