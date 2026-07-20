export type DesktopHostKind = "browser" | "electron" | "tauri";

export interface DesktopRuntimeInfo {
  hostKind: DesktopHostKind;
  platform: string;
  isPackaged: boolean;
  backendUrl: string;
}

const browserRuntime: DesktopRuntimeInfo = {
  hostKind: "browser",
  platform: "browser",
  isPackaged: false,
  backendUrl: "",
};

const isDesktopRuntimeInfo = (
  value: unknown,
): value is DesktopRuntimeInfo => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const runtime = value as Partial<DesktopRuntimeInfo>;

  return (
    (runtime.hostKind === "browser" ||
      runtime.hostKind === "electron" ||
      runtime.hostKind === "tauri") &&
    typeof runtime.platform === "string" &&
    typeof runtime.isPackaged === "boolean" &&
    typeof runtime.backendUrl === "string"
  );
};

const getLegacyElectronRuntime = (): DesktopRuntimeInfo | null => {
  const desktopApi = globalThis.window?.desktopApi;

  if (!desktopApi) {
    return null;
  }

  return {
    hostKind: "electron",
    platform: desktopApi.platform,
    isPackaged: desktopApi.isPackaged,
    backendUrl: desktopApi.backendUrl,
  };
};

export function getDesktopRuntime(): DesktopRuntimeInfo {
  const injectedRuntime = globalThis.window?.desktopRuntime;

  if (isDesktopRuntimeInfo(injectedRuntime)) {
    return injectedRuntime;
  }

  return getLegacyElectronRuntime() ?? browserRuntime;
}

export function isDesktopShell(runtime = getDesktopRuntime()) {
  return runtime.hostKind !== "browser";
}

export function getApiBaseUrl() {
  const viteApiUrl = import.meta.env.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }

  const runtime = getDesktopRuntime();

  return isDesktopShell(runtime) ? runtime.backendUrl : "/api";
}

export function getChatApiUrl() {
  const runtime = getDesktopRuntime();

  return isDesktopShell(runtime)
    ? `${runtime.backendUrl}/proxy/chat/default`
    : "/api/proxy/chat/default";
}

export function getRuntimeDisplayLabel(runtime = getDesktopRuntime()) {
  if (runtime.hostKind === "electron") {
    return `Electron · ${runtime.platform}`;
  }

  if (runtime.hostKind === "tauri") {
    return `Tauri · ${runtime.platform}`;
  }

  return "Browser Preview";
}

export function getRuntimeDescription(runtime = getDesktopRuntime()) {
  if (runtime.hostKind === "electron") {
    return "Electron 运行时通过后端 API 检查状态。";
  }

  if (runtime.hostKind === "tauri") {
    return "Tauri 运行时通过后端 API 检查状态。";
  }

  return "当前为浏览器预览模式，状态检查通过 /api 代理访问后端。";
}

export async function openExternalUrl(url: string) {
  const trimmedUrl = url.trim();
  const runtime = getDesktopRuntime();

  if (!/^https?:\/\//i.test(trimmedUrl)) {
    throw new Error("仅支持打开 http(s) 外部链接");
  }

  if (runtime.hostKind === "electron" && globalThis.window?.electronAPI?.invoke) {
    await globalThis.window.electronAPI.invoke("desktop:open-external", trimmedUrl);
    return;
  }

  const tauriOpen =
    (globalThis.window as any)?.__TAURI__?.shell?.open ??
    (globalThis.window as any)?.__TAURI_INTERNALS__?.plugins?.shell?.open;

  if (runtime.hostKind === "tauri" && typeof tauriOpen === "function") {
    await tauriOpen(trimmedUrl);
    return;
  }

  globalThis.window?.open(trimmedUrl, "_blank", "noopener,noreferrer");
}

export type NativeMessagingHostStatusKind =
  | "installed"
  | "not_installed"
  | "repair_needed"
  | "unsupported";

export interface NativeMessagingHostStatus {
  status: NativeMessagingHostStatusKind;
  installed: boolean;
  reason?: string;
}

export async function downloadBrowserExtension(): Promise<string> {
  const runtime = getDesktopRuntime();

  if (runtime.hostKind === "electron" && globalThis.window?.electronAPI?.invoke) {
    return String(
      await globalThis.window.electronAPI.invoke("desktop:download-browser-extension"),
    );
  }

  const tauriInvoke = (globalThis.window as any)?.__TAURI_INTERNALS__?.invoke;
  if (runtime.hostKind === "tauri" && typeof tauriInvoke === "function") {
    return String(await tauriInvoke("download_browser_extension"));
  }

  throw new Error("浏览器扩展下载仅支持 Electron 或 Tauri 桌面端");
}

export async function installNativeMessagingHost(): Promise<unknown> {
  const runtime = getDesktopRuntime();
  if (runtime.hostKind === "electron" && globalThis.window?.electronAPI?.invoke) {
    return globalThis.window.electronAPI.invoke("desktop:install-native-host");
  }
  const tauriInvoke = (globalThis.window as any)?.__TAURI_INTERNALS__?.invoke;
  if (runtime.hostKind === "tauri" && typeof tauriInvoke === "function") {
    return tauriInvoke("install_native_messaging_host");
  }
  throw new Error("Native Messaging 安装仅支持 Electron 或 Tauri 桌面端");
}

export async function getNativeMessagingHostStatus(): Promise<NativeMessagingHostStatus> {
  const runtime = getDesktopRuntime();
  if (runtime.hostKind === "electron" && globalThis.window?.electronAPI?.invoke) {
    return globalThis.window.electronAPI.invoke("desktop:get-native-host-status") as Promise<NativeMessagingHostStatus>;
  }
  const tauriInvoke = (globalThis.window as any)?.__TAURI_INTERNALS__?.invoke;
  if (runtime.hostKind === "tauri" && typeof tauriInvoke === "function") {
    return tauriInvoke("get_native_messaging_host_status") as Promise<NativeMessagingHostStatus>;
  }
  return {
    status: "unsupported",
    installed: false,
    reason: "Native Messaging 仅在桌面版 Windows 上可用",
  };
}

export async function uninstallNativeMessagingHost(): Promise<unknown> {
  const runtime = getDesktopRuntime();
  if (runtime.hostKind === "electron" && globalThis.window?.electronAPI?.invoke) {
    return globalThis.window.electronAPI.invoke("desktop:uninstall-native-host");
  }
  const tauriInvoke = (globalThis.window as any)?.__TAURI_INTERNALS__?.invoke;
  if (runtime.hostKind === "tauri" && typeof tauriInvoke === "function") {
    return tauriInvoke("uninstall_native_messaging_host");
  }
  throw new Error("Native Messaging 注销仅支持 Electron 或 Tauri 桌面端");
}
