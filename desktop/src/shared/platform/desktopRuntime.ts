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
  if ((import.meta as any).env.VITE_API_URL) {
    return (import.meta as any).env.VITE_API_URL as string;
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
