import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Copy, Download, Eye, ExternalLink, FileDown, FileUp, Globe2, KeyRound, MousePointer2, PlugZap, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { Alert, Badge, Button, Card, Modal, Select, TextInput } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import { ApiError, post } from "@/shared/lib/request";
import { downloadBrowserExtension, installNativeMessagingHost, uninstallNativeMessagingHost } from "@/shared/platform/desktopRuntime";
import { WebBridgeClient, WebBridgeRequestError, type WebBridgeStatus } from "@/shared/api/webbridge";
import MicroAppPageLayout from "../components/MicroAppPageLayout";

type Mode = "look" | "browse" | "act" | "transfer";
type ToolResult = Record<string, unknown>;

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

export default function JianXingPage() {
  const clientRef = useRef<WebBridgeClient | null>(null);
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
  const [nativeHostInstalled, setNativeHostInstalled] = useState(false);
  const [transport, setTransport] = useState<"websocket" | "native">("native");

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
    const handleExtensionMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.source !== "mira-webbridge-extension" || event.data?.type !== "WEBBRIDGE_OPEN_AUTHORIZATION_PAGE_RESULT") return;
      if (event.data.ok === false) {
        setError(String(event.data.message || "无法打开见行授权页，请重新加载扩展"));
      }
    };

    window.addEventListener("message", handleExtensionMessage);
    return () => window.removeEventListener("message", handleExtensionMessage);
  }, []);

  const connected = status.status === "connected";
  const extensionConnected = status.extensionConnected === true;
  const effectiveTransport = status.transport || transport;
  const visibleOperation = status.event === "started" ? `正在操作 Chrome：${status.operation || "浏览器页面"}` : status.event === "finished" ? `${status.operationOk === false ? "操作失败" : "已完成"}${status.operation ? `：${status.operation}` : ""}` : "";
  const isLook = mode === "look";
  const needsRef = action === "element" || ["click", "hover", "fill", "select", "scrollTo", "paginate", "switch", "close"].includes(action);
  const isFileUpload = mode === "transfer" && action === "upload";

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
      setError(cause instanceof Error ? cause.message : "无法连接见行服务");
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
      setNativeHostInstalled(true);
      message.success("Native Messaging 连接组件已安装");
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
      setNativeHostInstalled(false);
      if (transport === "native") {
        setTransport("websocket");
        await clientRef.current?.setTransport("websocket");
      }
      message.success("Native Messaging 已解除注册");
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "Native Messaging 解除注册失败");
    } finally {
      setNativeHostLoading(false);
    }
  };

  const handleTransportChange = async (next: string) => {
    const selected = next === "native" ? "native" : "websocket";
    if (selected === "native" && !nativeHostInstalled) {
      setError("请先安装 Native Messaging 连接组件");
      return;
    }
    if (!extensionConnected) {
      setError("请先在 Chrome 中完成见行扩展授权，扩展连接后才能切换连接方式");
      return;
    }
    try {
      await clientRef.current?.setTransport(selected);
      setTransport(selected);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "连接方式切换失败");
    }
  };

  return (
    <MicroAppPageLayout
      miniTitle="见行"
      title="见行"
      description="连接当前 Chrome，在本机安全地查看和操纵网页。见行与剪藏、Computer Use Studio 分开工作。"
      contentClassName="gap-4 pt-5"
    >
      {error ? <Alert variant="danger" title="操作失败">{error}</Alert> : null}
      {visibleOperation ? <Alert variant={status.operationOk === false ? "danger" : "info"} title="见行浏览器状态">{visibleOperation}{status.operationError ? `：${status.operationError}` : ""}</Alert> : null}
      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-text-primary">浏览器连接方式</div>
            <div className="mt-1 text-xs text-text-tertiary">见行扩展会在 Chrome 启动、安装或授权变化后自行连接；这里不会打开未知的扩展页面。Native Messaging 需要安装本机连接组件，升级 Mira 后可重新修复。</div>
          </div>
           <Select label="" value={effectiveTransport} onChange={(next) => void handleTransportChange(next)} options={[{ value: "native", label: "Native Messaging（主连接）" }, { value: "websocket", label: "WebSocket（开发调试）" }]} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button size="xs" variant="outline" onClick={() => void handleDownloadExtension()} disabled={extensionDownloadLoading}>
            <Download className="h-4 w-4" />{extensionDownloadLoading ? "下载中…" : "下载插件"}
          </Button>
          <Button size="xs" variant="outline" onClick={() => void handleInstallNativeHost()} disabled={nativeHostLoading}>
            <PlugZap className="h-4 w-4" />{nativeHostLoading ? "安装中…" : nativeHostInstalled ? "修复 Native" : "安装 Native"}
          </Button>
          {nativeHostInstalled ? <Button size="xs" variant="ghost" onClick={() => void handleUninstallNativeHost()} disabled={nativeHostLoading}>解除注册</Button> : null}
          <Button size="xs" variant="secondary" onClick={() => setExtensionModalOpen(true)}>
            <KeyRound className="h-4 w-4" />浏览器扩展授权
          </Button>
          <Badge variant={extensionConnected ? "success" : "warning"}>
            <Circle className="mr-1 inline h-2 w-2 fill-current" />
            {extensionConnected ? "扩展已连接" : connected ? "等待扩展" : "未连接"}
          </Badge>
          <Button size="xs" variant="outline" onClick={() => (connected ? clientRef.current?.close() : void connect())}>
            <PlugZap className="h-4 w-4" />{connected ? "断开" : "连接"}
          </Button>
          <Badge variant={nativeHostInstalled ? "success" : "neutral"}>{nativeHostInstalled ? "Native 已安装" : "Native 未安装"}</Badge>
        </div>
      </Card>
      <div className="grid min-h-0 gap-4 md:grid-cols-2">
        <Card padding="md" className="space-y-4">
          <div className="flex items-start justify-between gap-3"><div><h2 className="text-heading-2 text-text-primary">{modes.find((item) => item.id === mode)?.label} · 参数</h2><p className="mt-1 text-sm text-text-secondary">先读取页面，再使用快照中的稳定引用执行操作。</p></div><Badge variant="neutral">本机</Badge></div>
          <div className="grid gap-2 sm:grid-cols-2">{modes.map((item) => <button key={item.id} type="button" onClick={() => changeMode(item.id)} className={`rounded-ui-control border px-3 py-2 text-left text-sm ${mode === item.id ? "border-primary bg-primary/5 font-medium" : "border-border text-text-secondary hover:bg-surface-secondary"}`}>{item.label} <span className="ml-1 text-xs text-text-tertiary">{item.id}</span></button>)}</div>
          <Select label="操作方式" value={action} onChange={setAction} options={actions[mode]} />
          {needsRef ? <TextInput label="元素引用 ref" value={ref} onChange={setRef} placeholder="例如 e17" /> : null}
          {isFileUpload ? <label className="block text-sm text-text-secondary">文件<input className="mt-1 block w-full text-sm" type="file" onChange={(event) => onFileChange(event.target.files?.[0])} /></label> : null}
          {!isLook && !isFileUpload && !["back", "forward", "reload", "paginate", "scrollTo", "switch", "close"].includes(action) ? <TextInput label={action === "open" || action === "new" ? "网址" : action === "scroll" ? "滚动距离（px）" : action === "wait" ? "等待时间（ms）" : action === "drag" ? "起点 ref, 终点 ref" : action === "download" ? "下载地址" : "参数值"} value={value} onChange={setValue} placeholder="填写参数" /> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><span className="text-xs text-text-tertiary">{extensionConnected ? `请求将在本机 ${effectiveTransport === "native" ? "Native Messaging" : "WebSocket"} 通道中发送` : "请在 Chrome 中完成见行扩展授权，连接后才能发送请求"}</span><Button variant="primary" onClick={() => void run()} disabled={busy || !extensionConnected || (isFileUpload && !file)}><Send className="h-4 w-4" />{busy ? "执行中…" : isLook ? "观察页面" : "发送操作"}</Button></div>
        </Card>

        <Card padding="md" className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-heading-2 text-text-primary">页面结果</h2><Button size="xs" variant="ghost" onClick={() => { setResult(null); setError(""); }}><RotateCcw className="h-4 w-4" />清空</Button></div><div className="rounded-ui-control border border-border bg-surface-secondary p-3"><div className="text-xs text-text-tertiary">当前连接</div><div className="mt-2 text-sm font-medium text-text-primary">{extensionConnected ? "见行扩展已连接" : connected ? "等待扩展连接" : "未连接"}</div><div className="mt-1 font-mono text-xs text-text-tertiary">{status.status}</div></div>{result ? <div className="space-y-3"><pre className="max-h-[520px] overflow-auto rounded-ui-control border border-border bg-surface-secondary p-3 font-mono text-xs leading-5 text-text-secondary">{jsonText(result)}</pre>{typeof result.dataUrl === "string" ? <img src={result.dataUrl} alt="页面截图" className="max-h-64 w-full rounded-ui-control border border-border object-contain" /> : null}</div> : <div className="flex min-h-40 flex-col items-center justify-center text-center text-sm text-text-tertiary"><Eye className="mb-2 h-5 w-5" />还没有页面结果</div>}<div className="border-t border-border pt-3 text-xs text-text-tertiary"><div className="flex items-center gap-2"><FileDown className="h-4 w-4" />截图和结果只在本机 WebSocket 通道中传递</div></div></Card>
      </div>
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
            <p className="text-sm leading-6 text-text-secondary">生成一次性授权码后，见行扩展会自动打开授权页；如果 Chrome 没有切到授权页，点击工具栏中的见行图标即可进入。</p>
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
          <p className="text-xs leading-5 text-text-tertiary">授权码 5 分钟内有效且只能使用一次。生成后切到 Chrome 的见行授权页，粘贴并点击“授权并连接”。授权成功后回到这里点击“连接”。</p>
        </div>
      </Modal>
    </MicroAppPageLayout>
  );
}
