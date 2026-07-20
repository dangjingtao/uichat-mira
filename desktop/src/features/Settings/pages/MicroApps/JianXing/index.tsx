import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, CircleHelp, Copy, Download, Eye, ExternalLink, FileDown, FileUp, Globe2, KeyRound, MousePointer2, Plus, PlugZap, RefreshCw, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { Alert, Badge, Button, Card, FileUploadDropzone, Modal, NavigationCardTabs, Select, Table, TextInput, Tooltip } from "@/shared/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { message } from "@/shared/ui/Message";
import { ApiError, post } from "@/shared/lib/request";
import { downloadBrowserExtension, getNativeMessagingHostStatus, installNativeMessagingHost, uninstallNativeMessagingHost, type NativeMessagingHostStatus } from "@/shared/platform/desktopRuntime";
import { WebBridgeClient, WebBridgeRequestError, type ClipRule, type ClipRules, type WebBridgeStatus } from "@/shared/api/webbridge";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import ClipRuleDrawer from "./components/ClipRuleDrawer";

type Mode = "look" | "browse" | "act" | "transfer";
type WorkspaceTab = "jianxing" | "clipper";
type ConfiguredSiteRow = { host: string; enabled: boolean };
type ToolResult = Record<string, unknown>;

const workspaceTabs: Array<{ value: WorkspaceTab; label: string }> = [
  { value: "jianxing", label: "见行" },
  { value: "clipper", label: "剪藏" },
];

const modes: Array<{ id: Mode; label: string; description: string; icon: typeof Eye }> = [
  { id: "look", label: "看", description: "读取当前页面状态和稳定元素引用", icon: Eye },
  { id: "browse", label: "翻", description: "打开、返回、刷新、滚动和等待", icon: Globe2 },
  { id: "act", label: "点", description: "点击、填写、选择和发送按键", icon: MousePointer2 },
  { id: "transfer", label: "传", description: "上传文件或获取下载结果", icon: FileUp },
];

const actions: Record<Mode, Array<{ value: string; label: string }>> = {
  look: [
    { value: "snapshot", label: "页面快照" },
    { value: "page", label: "页面信息" },
    { value: "tabs", label: "标签页列表" },
    { value: "element", label: "元素详情" },
    { value: "screenshot", label: "页面截图" },
  ],
  browse: [
    { value: "open", label: "当前页打开网址" },
    { value: "new", label: "新开标签页" },
    { value: "switch", label: "切换标签页" },
    { value: "close", label: "关闭标签页" },
    { value: "back", label: "后退" },
    { value: "forward", label: "前进" },
    { value: "reload", label: "刷新" },
    { value: "scroll", label: "滚动" },
    { value: "scrollTo", label: "滚动到元素" },
    { value: "paginate", label: "翻页" },
    { value: "wait", label: "等待" },
  ],
  act: [
    { value: "click", label: "点击" },
    { value: "hover", label: "悬停" },
    { value: "drag", label: "拖拽" },
    { value: "fill", label: "填写" },
    { value: "select", label: "选择" },
    { value: "press", label: "按键" },
    { value: "dialog", label: "处理弹窗" },
  ],
  transfer: [
    { value: "upload", label: "上传文件" },
    { value: "download", label: "获取下载" },
  ],
};

const jsonText = (value: unknown) => JSON.stringify(value, null, 2);

const normalizeHost = (value: string) => {
  let input = value.trim().toLowerCase();
  if (!input) return "";
  try {
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(input)) input = `https://${input}`;
    return new URL(input).hostname.replace(/^www\./, "").replace(/\.$/, "");
  } catch {
    return input.split("/")[0].split(":")[0].replace(/^www\./, "").replace(/\.$/, "");
  }
};

const emptyRule = (host = ""): ClipRule => ({
  host,
  urlPattern: "",
  urlPatternMode: "wildcard",
  enabled: true,
  includeSelector: "",
  excludeSelectors: [],
  imagePolicy: { minWidth: 100, minHeight: 100, maxCount: 20 },
});

const ruleForEditor = (rule: ClipRule): ClipRule => ({
  ...rule,
  urlPatternMode: rule.urlPattern
    ? rule.urlPatternMode === "wildcard" ? "wildcard" : "regex"
    : "wildcard",
});

export default function JianXingPage() {
  const clientRef = useRef<WebBridgeClient | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("jianxing");
  const [mode, setMode] = useState<Mode>("look");
  const [action, setAction] = useState("snapshot");
  const [ref, setRef] = useState("");
  const [value, setValue] = useState("");
  const [file, setFile] = useState<{ name: string; mimeType: string; dataUrl: string } | null>(null);
  const [status, setStatus] = useState<WebBridgeStatus>({ status: "disconnected" });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ToolResult | null>(null);
  const [error, setError] = useState("");
  const [extensionCode, setExtensionCode] = useState("");
  const [extensionCodeLoading, setExtensionCodeLoading] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [extensionDownloadLoading, setExtensionDownloadLoading] = useState(false);
  const [nativeHostLoading, setNativeHostLoading] = useState(false);
  const [nativeHostChecking, setNativeHostChecking] = useState(true);
  const [nativeHostStatus, setNativeHostStatus] = useState<NativeMessagingHostStatus | null>(null);
  const [clipRules, setClipRules] = useState<ClipRules>({});
  const [ruleHost, setRuleHost] = useState("");
  const [ruleForm, setRuleForm] = useState<ClipRule>(() => emptyRule());
  const [rulesSaving, setRulesSaving] = useState(false);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [regionPicking, setRegionPicking] = useState<"include" | "exclude" | null>(null);
  const [rulesMessage, setRulesMessage] = useState("");
  const [rulesError, setRulesError] = useState("");
  const [ruleDrawerOpen, setRuleDrawerOpen] = useState(false);

  const refreshNativeHostStatus = useCallback(async () => {
    setNativeHostChecking(true);
    try {
      const nextStatus = await getNativeMessagingHostStatus();
      setNativeHostStatus(nextStatus);
      return nextStatus;
    } catch (cause) {
      const nextStatus: NativeMessagingHostStatus = {
        status: "repair_needed",
        installed: false,
        reason: cause instanceof Error ? cause.message : "无法读取 Native Messaging 状态",
      };
      setNativeHostStatus(nextStatus);
      return nextStatus;
    } finally {
      setNativeHostChecking(false);
    }
  }, []);

  useEffect(() => {
    const client = new WebBridgeClient();
    clientRef.current = client;
    const unsubscribe = client.onStatus(setStatus);
    return () => {
      unsubscribe();
      client.close();
      clientRef.current = null;
    };
  }, []);

  useEffect(() => {
    void refreshNativeHostStatus();
  }, [refreshNativeHostStatus]);

  useEffect(() => {
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source !== "mira-webbridge-extension" || event.data?.type !== "WEBBRIDGE_OPEN_AUTHORIZATION_PAGE_RESULT") return;
      if (event.data.ok === false) {
        setError(String(event.data.message || "无法打开触界授权页，请重新加载扩展"));
      }
    };

    window.addEventListener("message", handleExtensionMessage);
    return () => window.removeEventListener("message", handleExtensionMessage);
  }, []);

  const connected = status.status === "connected";
  const extensionConnected = status.extensionConnected === true;
  const nativeHostInstalled = nativeHostStatus?.status === "installed";
  const nativeHostRepairNeeded = nativeHostStatus?.status === "repair_needed";
  const nativeHostActionLabel = nativeHostLoading
    ? "安装中…"
    : nativeHostChecking
      ? "正在检查…"
      : nativeHostStatus?.status === "unsupported"
        ? "Native 不可用"
        : nativeHostInstalled || nativeHostRepairNeeded
          ? "修复 Native"
          : "安装 Native";
  const nativeHostStatusLabel = nativeHostChecking
    ? "正在检查 Native"
    : nativeHostStatus?.status === "installed"
      ? "Native 已安装"
      : nativeHostStatus?.status === "repair_needed"
        ? "Native 需修复"
        : nativeHostStatus?.status === "unsupported"
          ? "Native 不可用"
          : "Native 未安装";
  const visibleOperation = status.event === "started" ? `正在操作 Chrome：${status.operation || "浏览器页面"}` : status.event === "finished" ? `${status.operationOk === false ? "操作失败" : "已完成"}${status.operation ? `：${status.operation}` : ""}` : "";
  const isLook = mode === "look";
  const needsRef = action === "element" || ["click", "hover", "fill", "select", "scrollTo", "paginate", "switch", "close"].includes(action);
  const isFileUpload = mode === "transfer" && action === "upload";

  const loadClipRules = async () => {
    if (!clientRef.current || !connected || !extensionConnected) {
      setRulesError("请先连接触界扩展");
      return;
    }
    setRulesLoading(true);
    setRulesError("");
    try {
      const nextRules = await clientRef.current.requestClipRules("clip_rules_get");
      setClipRules(nextRules);
      const selectedHost = normalizeHost(ruleHost) || Object.keys(nextRules).sort()[0] || "";
      setRuleHost(selectedHost);
      setRuleForm(nextRules[selectedHost] ? ruleForEditor(nextRules[selectedHost]) : emptyRule(selectedHost));
      setRulesMessage("网站规则已从触界扩展加载");
    } catch (cause) {
      setRulesError(cause instanceof Error ? cause.message : "无法读取网站规则");
    } finally {
      setRulesLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceTab === "clipper" && connected && extensionConnected) void loadClipRules();
    // 连接状态变化时重新读取，避免显示断开前的旧规则。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceTab, connected, extensionConnected]);

  const selectRuleHost = (host: string) => {
    const normalizedHost = normalizeHost(host);
    setRuleHost(normalizedHost);
    setRuleForm(clipRules[normalizedHost] ? ruleForEditor(clipRules[normalizedHost]) : emptyRule(normalizedHost));
    setRulesMessage("");
    setRulesError("");
  };

  const openRuleEditor = (host: string) => {
    selectRuleHost(host);
    setRuleDrawerOpen(true);
  };

  const openNewRuleDrawer = () => {
    setRuleHost("");
    setRuleForm(emptyRule());
    setRulesMessage("");
    setRulesError("");
    setRuleDrawerOpen(true);
  };

  const updateRuleForm = (patch: Partial<ClipRule>) => setRuleForm((current) => ({ ...current, ...patch }));

  const configuredSiteRows = useMemo<ConfiguredSiteRow[]>(
    () => Object.keys(clipRules).sort().map((host) => ({ host, enabled: clipRules[host].enabled })),
    [clipRules],
  );

  const configuredSiteColumns = useMemo<ColumnDef<ConfiguredSiteRow>[]>(
    () => [
      {
        header: "网站",
        accessorKey: "host",
        meta: { ellipsisTooltip: true },
        cell: ({ row }) => (
          <button
            type="button"
            className={`max-w-full truncate text-left text-sm font-medium ${row.original.host === ruleHost ? "text-primary" : "text-text-primary"}`}
            onClick={() => openRuleEditor(row.original.host)}
          >
            {row.original.host}
          </button>
        ),
      },
      {
        header: "状态",
        accessorKey: "enabled",
        meta: { width: 72, align: "center" },
        cell: ({ row }) => (
          <Badge variant={row.original.enabled ? "success" : "muted"}>
            {row.original.enabled ? "已启用" : "已停用"}
          </Badge>
        ),
      },
    ],
    [openRuleEditor, ruleHost],
  );

  const pickRuleRegion = async (kind: "include" | "exclude") => {
    if (!clientRef.current || !connected || !extensionConnected) {
      setRulesError("请先连接触界扩展");
      return;
    }
    setRegionPicking(kind);
    setRulesError("");
    setRulesMessage(kind === "include" ? "请在 Chrome 中点击正文区域" : "请在 Chrome 中点击要排除的区域");
    try {
      const picked = await clientRef.current.pickClipRegion(kind);
      const currentHost = normalizeHost(ruleHost);
      const baseRule = currentHost === picked.host
        ? ruleForm
        : clipRules[picked.host] ? ruleForEditor(clipRules[picked.host]) : emptyRule(picked.host);
      if (kind === "include") {
        setRuleHost(picked.host);
        setRuleForm({ ...baseRule, host: picked.host, includeSelector: picked.selector, includeRegion: picked.summary });
        setRulesMessage(`已选择 ${picked.host} 的正文区域`);
      } else {
        setRuleHost(picked.host);
        const existing = baseRule.excludeRegions
          || baseRule.excludeSelectors.map((selector) => ({ selector, summary: undefined }));
        const nextRegions = existing.some((region) => region.selector === picked.selector)
          ? existing
          : [...existing, { selector: picked.selector, summary: picked.summary }];
        setRuleForm({
          ...baseRule,
          host: picked.host,
          excludeSelectors: nextRegions.map((region) => region.selector),
          excludeRegions: nextRegions,
        });
        setRulesMessage(`已添加 ${picked.host} 的排除区域`);
      }
    } catch (cause) {
      setRulesError(cause instanceof Error ? cause.message : "区域选择失败");
      setRulesMessage("");
    } finally {
      setRegionPicking(null);
    }
  };

  const removeExcludeRegion = (selector: string) => {
    setRuleForm((current) => {
      const nextRegions = (current.excludeRegions || []).filter((region) => region.selector !== selector);
      return { ...current, excludeSelectors: nextRegions.map((region) => region.selector), excludeRegions: nextRegions };
    });
  };

  const saveClipRule = async () => {
    const host = normalizeHost(ruleHost || ruleForm.host);
    if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(host)) {
      setRulesError("请输入有效的网站域名");
      return;
    }
    if (!clientRef.current || !connected || !extensionConnected) {
      setRulesError("请先连接触界扩展");
      return;
    }
    const nextRule: ClipRule = {
      ...ruleForm,
      host,
      urlPattern: ruleForm.urlPattern?.trim() || "",
      urlPatternMode: ruleForm.urlPatternMode === "regex" ? "regex" : "wildcard",
      includeSelector: ruleForm.includeSelector.trim(),
      excludeSelectors: ruleForm.excludeSelectors.map((item) => item.trim()).filter(Boolean),
      includeRegion: ruleForm.includeRegion,
      excludeRegions: ruleForm.excludeRegions,
      imagePolicy: {
        minWidth: Math.max(0, Math.min(10000, Math.round(Number(ruleForm.imagePolicy.minWidth) || 0))),
        minHeight: Math.max(0, Math.min(10000, Math.round(Number(ruleForm.imagePolicy.minHeight) || 0))),
        maxCount: Math.max(1, Math.min(50, Math.round(Number(ruleForm.imagePolicy.maxCount) || 20))),
      },
    };
    if (nextRule.urlPattern) {
      try {
        if (nextRule.urlPatternMode === "regex") new RegExp(nextRule.urlPattern);
      } catch {
        setRulesError("URL 正则格式无效，请检查括号、反斜杠和量词");
        return;
      }
    }
    const nextRules = { ...clipRules, [host]: nextRule };
    setRulesSaving(true);
    setRulesError("");
    try {
      const savedRules = await clientRef.current.requestClipRules("clip_rules_set", nextRules);
      setClipRules(savedRules);
      setRuleHost(host);
      setRuleForm(savedRules[host] ? ruleForEditor(savedRules[host]) : nextRule);
      setRulesMessage("网站规则已保存到触界扩展");
      setRuleDrawerOpen(false);
    } catch (cause) {
      setRulesError(cause instanceof Error ? cause.message : "保存网站规则失败");
    } finally {
      setRulesSaving(false);
    }
  };

  const deleteClipRule = async () => {
    const host = normalizeHost(ruleHost);
    if (!host || !clipRules[host]) {
      setRulesError("当前网站没有已保存的规则");
      return;
    }
    if (!clientRef.current || !connected || !extensionConnected) {
      setRulesError("请先连接触界扩展");
      return;
    }
    const nextRules = { ...clipRules };
    delete nextRules[host];
    setRulesSaving(true);
    setRulesError("");
    try {
      const savedRules = await clientRef.current.requestClipRules("clip_rules_set", nextRules);
      setClipRules(savedRules);
      const nextHost = Object.keys(savedRules).sort()[0] || "";
      setRuleHost(nextHost);
      setRuleForm(savedRules[nextHost] ? ruleForEditor(savedRules[nextHost]) : emptyRule(nextHost));
      setRulesMessage("网站规则已删除");
      setRuleDrawerOpen(false);
    } catch (cause) {
      setRulesError(cause instanceof Error ? cause.message : "删除网站规则失败");
    } finally {
      setRulesSaving(false);
    }
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setAction(actions[next][0].value);
    setRef("");
    setValue("");
    setFile(null);
    setError("");
  };

  const connect = async () => {
    try {
      setError("");
      await clientRef.current?.connect();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法连接触界服务");
    }
  };

  const buildParams = (): Record<string, unknown> => {
    if (mode === "look") {
      if (action === "page") return { mode: action, include: ["text", "interactive"] };
      if (action === "element") return { mode: action, ref };
      return { mode: action };
    }
    if (mode === "browse") {
      if (action === "open" || action === "new") return { mode: action, url: value, after: { wait: "navigation", include: ["snapshot"] } };
      if (action === "switch") return { mode: action, tabId: Number(ref) };
      if (action === "close") return { mode: action, tabId: ref ? Number(ref) : undefined };
      if (["scrollTo", "paginate"].includes(action)) return { mode: action, ref, after: { include: ["snapshot"] } };
      if (action === "scroll" || action === "wait") return { mode: action, amount: Number(value) || undefined, after: { include: ["snapshot"] } };
      return { mode: action, after: { wait: action === "reload" ? "navigation" : "none", include: ["snapshot"] } };
    }
    if (mode === "act") {
      if (action === "drag") {
        const [fromRef, toRef] = value.split(",").map((item) => item.trim());
        return { mode: action, fromRef, toRef, after: { include: ["snapshot"] } };
      }
      if (action === "press") return { mode: action, key: value, ref: ref || undefined, after: { include: ["snapshot"] } };
      if (action === "dialog") return { mode: action, action: value || "accept" };
      return { mode: action, ref, value, after: { include: ["snapshot"] } };
    }
    if (action === "upload") return { mode: action, ref, file };
    return { mode: action, ref: ref || undefined, url: value || undefined };
  };

  const run = async () => {
    if (!clientRef.current || !connected || !extensionConnected) return;
    setBusy(true);
    setError("");
    try {
      const response = await clientRef.current.request(mode, buildParams());
      setResult((response && typeof response === "object" ? response : { value: response }) as ToolResult);
    } catch (cause) {
      if (cause instanceof WebBridgeRequestError) setError(`${cause.code}: ${cause.message}`);
      else setError(cause instanceof Error ? cause.message : "浏览器操作失败");
    } finally {
      setBusy(false);
    }
  };

  const onFileChange = (selected: File | undefined) => {
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () => setFile({ name: selected.name, mimeType: selected.type || "application/octet-stream", dataUrl: String(reader.result) });
    reader.readAsDataURL(selected);
  };

  const generateExtensionCode = async () => {
    setExtensionCodeLoading(true);
    try {
      const response = await post<{ code: string }>("/oauth/extension/authorization-code");
      setExtensionCode(response.code);
      window.postMessage({
        source: "mira-webbridge-ui",
        type: "WEBBRIDGE_OPEN_AUTHORIZATION_PAGE",
        requestId: `authorize_${Date.now()}`,
      }, window.location.origin);
      message.success("授权码已生成，5 分钟内有效且只能使用一次");
    } catch (cause) {
      message.error(cause instanceof ApiError ? cause.message : "生成授权码失败");
    } finally {
      setExtensionCodeLoading(false);
    }
  };

  const openExtensionAuthorizationPage = () => {
    window.postMessage({
      source: "mira-webbridge-ui",
      type: "WEBBRIDGE_OPEN_AUTHORIZATION_PAGE",
      requestId: `authorize_${Date.now()}`,
    }, window.location.origin);
  };

  const copyExtensionCode = async () => {
    if (!extensionCode) return;
    await navigator.clipboard.writeText(extensionCode);
    message.success("授权码已复制");
  };

  const handleDownloadExtension = async () => {
    setExtensionDownloadLoading(true);
    try {
      await downloadBrowserExtension();
      message.success("Mira Clipper 已下载到系统下载目录");
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "插件下载失败");
    } finally {
      setExtensionDownloadLoading(false);
    }
  };

  const handleInstallNativeHost = async () => {
    setNativeHostLoading(true);
    try {
      await installNativeMessagingHost();
      const nextStatus = await refreshNativeHostStatus();
      if (nextStatus.status === "installed") {
        message.success("Native Messaging 连接组件已安装");
      } else {
        message.warning(nextStatus.reason || "Native Messaging 安装后仍需修复");
      }
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "Native Messaging 安装失败");
    } finally {
      setNativeHostLoading(false);
    }
  };

  const handleUninstallNativeHost = async () => {
    setNativeHostLoading(true);
    try {
      await uninstallNativeMessagingHost();
      await refreshNativeHostStatus();
      clientRef.current?.close();
      message.success("Native Messaging 已解除注册");
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "Native Messaging 解除注册失败");
    } finally {
      setNativeHostLoading(false);
    }
  };

  return (
    <MicroAppPageLayout
      miniTitle="触界"
      title="触界"
      description="连接当前 Chrome，在本机使用见行操作网页，或通过剪藏采集内容。"
      contentClassName="gap-4 pt-5"
    >
      {error ? <Alert variant="danger" title="操作失败">{error}</Alert> : null}
      {visibleOperation ? <Alert variant={status.operationOk === false ? "danger" : "info"} title="见行浏览器状态">{visibleOperation}{status.operationError ? `：${status.operationError}` : ""}</Alert> : null}
      <Card padding="sm" className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-text-primary">Chrome 连接</div>
          <Badge variant={extensionConnected ? "success" : "warning"}>
            <Circle className="mr-1 inline h-2 w-2 fill-current" />
            {extensionConnected ? "扩展已连接" : connected ? "等待扩展" : "未连接"}
          </Badge>
          <Badge variant={nativeHostInstalled ? "success" : nativeHostRepairNeeded ? "warning" : "neutral"}>{nativeHostStatusLabel}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button size="xs" variant="outline" onClick={() => void handleDownloadExtension()} disabled={extensionDownloadLoading}>
            <Download className="h-4 w-4" />{extensionDownloadLoading ? "下载中…" : "下载插件"}
          </Button>
          <Button size="xs" variant="outline" onClick={() => void handleInstallNativeHost()} disabled={nativeHostLoading || nativeHostChecking || nativeHostStatus?.status === "unsupported"}>
            <PlugZap className="h-4 w-4" />{nativeHostActionLabel}
          </Button>
          {nativeHostStatus && nativeHostStatus.status !== "not_installed" && nativeHostStatus.status !== "unsupported" ? <Button size="xs" variant="ghost" onClick={() => void handleUninstallNativeHost()} disabled={nativeHostLoading || nativeHostChecking}>解除注册</Button> : null}
          <Button size="xs" variant="secondary" onClick={() => setExtensionModalOpen(true)}>
            <KeyRound className="h-4 w-4" />浏览器扩展授权
          </Button>
          <Button size="xs" variant="outline" onClick={() => (connected ? clientRef.current?.close() : void connect())}>
            <PlugZap className="h-4 w-4" />{connected ? "断开" : "连接"}
          </Button>
          {nativeHostStatus?.reason ? <span className="text-xs text-text-tertiary">{nativeHostStatus.reason}</span> : null}
          {extensionConnected ? <span className="text-xs text-text-tertiary">扩展 v{status.extensionVersion || "未知"} · {status.capabilities?.includes("clip_rules") ? "支持区域点选" : "未报告区域点选"}</span> : null}
        </div>
      </Card>
      <NavigationCardTabs<WorkspaceTab>
        tabs={workspaceTabs}
        value={workspaceTab}
        onChange={setWorkspaceTab}
        activeTabStyle="plain"
        className="w-full"
      />
      {workspaceTab === "jianxing" ? (
        <div className="grid min-h-0 gap-4 md:grid-cols-2">
          <Card padding="md" className="space-y-4">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-heading-2 text-text-primary">{modes.find((item) => item.id === mode)?.label} · 参数</h2><p className="mt-1 text-sm text-text-secondary">先读取页面，再使用快照中的稳定引用执行操作。</p></div><Badge variant="neutral">本机</Badge></div>
            <div className="grid gap-2 sm:grid-cols-2">{modes.map((item) => <button key={item.id} type="button" onClick={() => changeMode(item.id)} className={`rounded-ui-control border px-3 py-2 text-left text-sm ${mode === item.id ? "border-primary bg-primary/5 font-medium" : "border-border text-text-secondary hover:bg-surface-secondary"}`}>{item.label} <span className="ml-1 text-xs text-text-tertiary">{item.id}</span></button>)}</div>
            <Select label="操作方式" value={action} onChange={setAction} options={actions[mode]} />
            {needsRef ? <TextInput label="元素引用 ref" value={ref} onChange={setRef} placeholder="例如 e17" /> : null}
            {isFileUpload ? (
              <div className="space-y-1">
                <div className="text-sm text-text-secondary">文件</div>
                <FileUploadDropzone
                  onSelectFiles={(files) => onFileChange(files?.[0])}
                  maxCount={1}
                  helperText={file?.name || "请选择一个文件"}
                />
              </div>
            ) : null}
            {!isLook && !isFileUpload && !["back", "forward", "reload", "paginate", "scrollTo", "switch", "close"].includes(action) ? <TextInput label={action === "open" || action === "new" ? "网址" : action === "scroll" ? "滚动距离（px）" : action === "wait" ? "等待时间（ms）" : action === "drag" ? "起点 ref, 终点 ref" : action === "download" ? "下载地址" : "参数值"} value={value} onChange={setValue} placeholder="填写参数" /> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><span className="text-xs text-text-tertiary">{extensionConnected ? "请求将在本机 Native Messaging 通道中发送" : "请在 Chrome 中完成触界扩展授权，连接后才能发送请求"}</span><Button variant="primary" onClick={() => void run()} disabled={busy || !extensionConnected || (isFileUpload && !file)}><Send className="h-4 w-4" />{busy ? "执行中…" : isLook ? "观察页面" : "发送操作"}</Button></div>
          </Card>

          <Card padding="md" className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-heading-2 text-text-primary">页面结果</h2><Button size="xs" variant="ghost" onClick={() => { setResult(null); setError(""); }}><RotateCcw className="h-4 w-4" />清空</Button></div><div className="rounded-ui-control border border-border bg-surface-secondary p-3"><div className="text-xs text-text-tertiary">当前连接</div><div className="mt-2 text-sm font-medium text-text-primary">{extensionConnected ? "触界扩展已连接" : connected ? "等待扩展连接" : "未连接"}</div><div className="mt-1 font-mono text-xs text-text-tertiary">{status.status}</div></div>{result ? <div className="space-y-3"><pre className="max-h-[520px] overflow-auto rounded-ui-control border border-border bg-surface-secondary p-3 font-mono text-xs leading-5 text-text-secondary">{jsonText(result)}</pre>{typeof result.dataUrl === "string" ? <img src={result.dataUrl} alt="页面截图" className="max-h-64 w-full rounded-ui-control border border-border object-contain" /> : null}</div> : <div className="flex min-h-40 flex-col items-center justify-center text-center text-sm text-text-tertiary"><Eye className="mb-2 h-5 w-5" />还没有页面结果</div>}<div className="border-t border-border pt-3 text-xs text-text-tertiary"><div className="flex items-center gap-2"><FileDown className="h-4 w-4" />结果仅通过本机连接通道传递</div></div></Card>
        </div>
      ) : (
        <Card padding="md" className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <h2 className="text-heading-2 text-text-primary">网站规则</h2>
              <Tooltip text="只对已配置的网站生效，未配置网站继续使用默认提取。" placement="top">
                <span aria-label="网站规则说明" className="cursor-help text-icon-secondary">
                  <CircleHelp className="h-3.5 w-3.5" />
                </span>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void loadClipRules()}
                disabled={rulesLoading}
              >
                <RefreshCw className={`h-4 w-4 ${rulesLoading ? "animate-spin" : ""}`} />
                {rulesLoading ? "同步中…" : "同步规则"}
              </Button>
              <Button size="sm" onClick={openNewRuleDrawer}>
                <Plus className="h-4 w-4" />新增规则
              </Button>
            </div>
          </div>
          {rulesError ? <Alert variant="danger" title="规则同步失败">{rulesError}</Alert> : null}
          {rulesMessage ? <Alert variant="success" title="规则状态">{rulesMessage}</Alert> : null}
          <div className="min-h-0 flex-1 overflow-hidden rounded-ui-control border border-border">
            <Table
              data={configuredSiteRows}
              columns={configuredSiteColumns}
              compact
              stickyHeader
              emptyState={<span className="text-xs text-text-tertiary">暂无网站规则</span>}
              className="h-full rounded-none border-0 shadow-none"
            />
          </div>
        </Card>
      )}
      <ClipRuleDrawer
        open={ruleDrawerOpen}
        onClose={() => setRuleDrawerOpen(false)}
        ruleHost={ruleHost}
        ruleForm={ruleForm}
        clipRules={clipRules}
        rulesSaving={rulesSaving}
        regionPicking={regionPicking}
        extensionConnected={extensionConnected}
        rulesError={rulesError}
        rulesMessage={rulesMessage}
        onRuleHostChange={(value) => {
          setRuleHost(value);
          const normalizedHost = normalizeHost(value);
          if (!clipRules[normalizedHost]) setRuleForm(emptyRule(normalizedHost));
        }}
        onRuleFormChange={updateRuleForm}
        onPickRuleRegion={(kind) => void pickRuleRegion(kind)}
        onRemoveExcludeRegion={removeExcludeRegion}
        onDelete={() => void deleteClipRule()}
        onSave={() => void saveClipRule()}
      />
      <Modal
        open={extensionModalOpen}
        title="浏览器扩展授权"
        width={560}
        onClose={() => setExtensionModalOpen(false)}
        footer={<Button variant="secondary" size="sm" onClick={() => setExtensionModalOpen(false)}>关闭</Button>}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-text-secondary" />
            <p className="text-sm leading-6 text-text-secondary">生成一次性授权码后，触界扩展会自动打开授权页；如果 Chrome 没有切到授权页，点击工具栏中的触界图标即可进入。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={extensionCodeLoading} onClick={() => void generateExtensionCode()}>
              <KeyRound className="h-4 w-4" />{extensionCodeLoading ? "生成中..." : "生成授权码"}
            </Button>
            {extensionCode ? <>
              <code className="rounded-ui-control border border-border bg-surface-secondary px-3 py-2 text-sm font-semibold tracking-[0.16em] text-text-primary">{extensionCode}</code>
              <Button variant="ghost" size="sm" onClick={() => void copyExtensionCode()}><Copy className="h-4 w-4" />复制</Button>
              <Button variant="ghost" size="sm" onClick={openExtensionAuthorizationPage}><ExternalLink className="h-4 w-4" />打开授权页</Button>
            </> : null}
          </div>
          <p className="text-xs leading-5 text-text-tertiary">授权码 5 分钟内有效且只能使用一次。生成后切到 Chrome 的触界授权页，粘贴并点击“授权并连接”。授权成功后回到这里点击“连接”。</p>
        </div>
      </Modal>
    </MicroAppPageLayout>
  );
}
