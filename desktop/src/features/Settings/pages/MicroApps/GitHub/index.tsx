import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Github,
  KeyRound,
  LoaderCircle,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import { Button, TextInput } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import {
  disconnectGitHub,
  getGitHubConnection,
  getGitHubRepositories,
  pollGitHubDeviceFlow,
  saveGitHubConnection,
  startGitHubDeviceFlow,
  validateGitHubConnection,
  type GitHubConnectionResponse,
  type GitHubDeviceFlow,
  type GitHubInstallation,
} from "@/shared/api/github";
import MicroAppPageLayout from "../components/MicroAppPageLayout";

const statusText: Record<GitHubConnectionResponse["connection"]["status"], string> = {
  unconfigured: "未配置",
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
  const [clientId, setClientId] = useState("");
  const [appSlug, setAppSlug] = useState("");
  const [installations, setInstallations] = useState<GitHubInstallation[]>([]);
  const [repositoryCount, setRepositoryCount] = useState(0);
  const [deviceFlow, setDeviceFlow] = useState<GitHubDeviceFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
    setClientId(result.connection.clientId);
    setAppSlug(result.connection.appSlug);
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

  const saveSettings = async () => {
    if (!clientId.trim() || !appSlug.trim()) {
      message.warning("请填写 GitHub App Client ID 和 App Slug");
      return;
    }
    setSaving(true);
    try {
      const result = await saveGitHubConnection({
        clientId: clientId.trim(),
        appSlug: appSlug.trim(),
        enabled: true,
      });
      applyConnection(result);
      setInstallations([]);
      setRepositoryCount(0);
      message.success("GitHub App 配置已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存 GitHub 配置失败");
    } finally {
      setSaving(false);
    }
  };

  const beginConnection = async () => {
    setConnecting(true);
    stopPolling();
    try {
      const flow = await startGitHubDeviceFlow();
      setDeviceFlow(flow);
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

  return (
    <MicroAppPageLayout
      miniTitle="Micro Apps"
      title="GitHub"
      description="连接 GitHub App，并由 GitHub 原生安装页按仓库授权。Mira 只看到你明确交给它的项目。"
      contentClassName="space-y-5 pt-5"
      slot={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {connected ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => void validateConnection()} disabled={refreshing}>
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
              <img src={connection.connection.avatarUrl} alt="GitHub avatar" className="h-14 w-14 rounded-ui-panel object-cover" />
            ) : (
              <Github className="h-7 w-7" />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-text-primary">
                {connection?.connection.login || "GitHub App 尚未连接"}
              </h2>
              <Badge variant={statusVariant(connection?.connection.status ?? "unconfigured")}>
                {statusText[connection?.connection.status ?? "unconfigured"]}
              </Badge>
              {connected ? <Badge variant="muted">Device Flow</Badge> : null}
            </div>
            <p className="text-sm leading-6 text-text-secondary">
              身份授权与仓库安装范围分开管理；仓库边界由 GitHub App installation 强制执行，不靠 Mira 前端筛选。
            </p>
          </div>
          <div className="grid grid-cols-2 gap-5 border-t border-border pt-4 text-left md:border-l md:border-t-0 md:pl-5 md:pt-0">
            <Metric label="安装实例" value={String(installations.length)} />
            <Metric label="已授权仓库" value={String(repositoryCount)} />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6 text-sm text-text-secondary">正在加载 GitHub 微应用...</Card>
      ) : (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            <Card className="p-5">
              <div className="mb-5 flex items-start gap-3">
                <Settings2 className="mt-0.5 h-5 w-5 text-icon-secondary" />
                <div>
                  <h3 className="font-semibold text-text-primary">GitHub App 配置</h3>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    桌面端使用 Device Flow，不保存 Client Secret，也不打包 GitHub App 私钥。请先在 GitHub App 设置里启用 Device Flow。
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Client ID">
                  <TextInput value={clientId} onChange={setClientId} placeholder="Iv1.xxxxxxxxxxxxxxxx" />
                </Field>
                <Field label="App Slug">
                  <TextInput value={appSlug} onChange={setAppSlug} placeholder="uichat-mira" />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" onClick={() => void saveSettings()} disabled={saving}>
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {saving ? "保存中" : "保存配置"}
                </Button>
                <a
                  href="https://github.com/settings/apps/new"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-2 rounded-ui-control px-3 text-sm font-medium text-primary hover:bg-primary/10"
                >
                  创建 GitHub App
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </Card>

            {!connected ? (
              <Card className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-5 w-5 text-icon-secondary" />
                    <div>
                      <h3 className="font-semibold text-text-primary">连接 GitHub 账号</h3>
                      <p className="mt-1 text-sm leading-6 text-text-secondary">
                        浏览器确认身份后，GitHub 再让你为个人账号或组织选择全部仓库或指定仓库。
                      </p>
                    </div>
                  </div>
                  <Button variant="primary" onClick={() => void beginConnection()} disabled={connecting || !clientId.trim() || !appSlug.trim()}>
                    {connecting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Github className="h-4 w-4" />}
                    {connecting ? "等待授权" : "连接 GitHub"}
                  </Button>
                </div>

                {deviceFlow ? (
                  <div className="mt-5 rounded-ui-panel border border-primary/20 bg-primary/5 p-4">
                    <div className="text-sm font-medium text-text-primary">在 GitHub 页面输入授权码</div>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <code className="rounded-ui-control border border-border bg-surface-primary px-4 py-2 text-lg font-semibold tracking-[0.18em] text-text-primary">
                        {deviceFlow.userCode}
                      </code>
                      <Button variant="ghost" size="sm" onClick={() => void copyCode()}>
                        <Copy className="h-4 w-4" />复制
                      </Button>
                      <a href={deviceFlow.verificationUri} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        打开授权页 <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-text-secondary">
                      Mira 正在等待 GitHub 回传结果。授权码到期后需要重新生成。
                    </p>
                  </div>
                ) : null}
              </Card>
            ) : (
              <Card padding="none">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
                  <div>
                    <h3 className="font-semibold text-text-primary">项目授权</h3>
                    <p className="mt-1 text-sm leading-6 text-text-secondary">
                      这里展示 GitHub App installation 实际授予的仓库，不维护第二套虚假的项目白名单。
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {connection?.installUrl ? (
                      <a href={connection.installUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-ui-control border border-primary/20 px-3 text-sm font-medium text-primary hover:bg-primary/10">
                        添加仓库授权 <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={() => void loadRepositories()} disabled={refreshing}>
                      <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />刷新
                    </Button>
                  </div>
                </div>

                {installations.length === 0 ? (
                  <div className="p-8 text-center">
                    <ShieldCheck className="mx-auto h-8 w-8 text-icon-secondary" />
                    <div className="mt-3 font-medium text-text-primary">还没有 GitHub App installation</div>
                    <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-text-secondary">
                      点击“添加仓库授权”，在 GitHub 原生页面选择账号或组织，并选择 Only select repositories。
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
                  <h3 className="font-semibold text-text-primary">权限边界</h3>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-text-secondary">
                    <p>GitHub 负责决定 Mira 能访问哪些仓库；移除 installation 或仓库后，访问立即失效。</p>
                    <p>这一页只负责授权与仓库范围。Issue、PR、Actions 等执行能力继续通过 GitHub MCP / Harness 消费，不在页面里重复造 API 工具。</p>
                  </div>
                </div>
              </div>
            </Card>
            <Card className="p-5">
              <h3 className="font-semibold text-text-primary">建议的 GitHub App 权限</h3>
              <div className="mt-3 space-y-2 text-sm leading-6 text-text-secondary">
                <p><strong className="text-text-primary">Metadata</strong>：Read-only（必需）</p>
                <p><strong className="text-text-primary">Contents / Issues / Pull requests / Actions</strong>：按 Mira 实际启用的 MCP toolset 再开。</p>
                <p>第一版先少给权限，后面需要写操作再由用户回 GitHub 调整。</p>
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
            <img src={installation.account.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary"><Github className="h-5 w-5" /></div>
          )}
          <div className="min-w-0">
            <div className="font-medium text-text-primary">{installation.account.login}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="muted">
                {installation.repositorySelection === "selected" ? "指定仓库" : "全部仓库"}
              </Badge>
              <span className="text-xs text-text-secondary">{installation.repositories.length} 个仓库</span>
            </div>
          </div>
        </div>
        <a href={installation.manageUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          管理授权 <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {installation.repositories.map((repository) => (
          <a key={repository.id} href={repository.htmlUrl} target="_blank" rel="noreferrer" className="rounded-ui-panel border border-border p-3 transition-colors hover:bg-surface-secondary/50">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-text-primary">{repository.fullName}</span>
              {repository.private ? <Badge variant="muted">Private</Badge> : null}
            </div>
            <div className="mt-1 text-xs text-text-secondary">默认分支：{repository.defaultBranch || "-"}</div>
          </a>
        ))}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-text-primary">{label}</span>
      {children}
    </label>
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
