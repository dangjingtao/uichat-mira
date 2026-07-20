import { getDesktopRuntime } from "@/shared/platform/desktopRuntime";
import { getSession, notifyAuthRequired } from "@/shared/lib/sessionStorage";

export type WebBridgeStatus = {
  status: "connecting" | "connected" | "disconnected" | "error";
  extensionConnected?: boolean;
  tools?: unknown[];
  code?: string;
  message?: string;
  event?: "started" | "finished";
  tabId?: number;
  operation?: string;
  operationOk?: boolean;
  operationError?: string;
  protocolVersion?: number;
  extensionVersion?: string;
  minExtensionVersion?: string;
  transport?: "websocket" | "native";
  capabilities?: unknown[];
};

export type WebBridgeResponse = {
  ok: boolean;
  result?: unknown;
  error?: { code: string; message: string; retryable?: boolean; suggestedAction?: string };
};

export type ClipRule = {
  host: string;
  urlPattern?: string;
  urlPatternMode?: "wildcard" | "regex";
  enabled: boolean;
  includeSelector: string;
  excludeSelectors: string[];
  includeRegion?: ClipRegionSummary;
  excludeRegions?: Array<{ selector: string; summary?: ClipRegionSummary }>;
  imagePolicy: {
    minWidth: number;
    minHeight: number;
    maxCount: number;
  };
};

export type ClipRules = Record<string, ClipRule>;

export type ClipRegionSummary = {
  tag: string;
  text: string;
  elementCount: number;
  imageCount: number;
};

export type ClipRegionPickResult = {
  host: string;
  url: string;
  selector: string;
  summary: ClipRegionSummary;
};

export class WebBridgeRequestError extends Error {
  code: string;
  retryable: boolean;
  suggestedAction?: string;

  constructor(error: NonNullable<WebBridgeResponse["error"]>) {
    super(error.message);
    this.name = "WebBridgeRequestError";
    this.code = error.code;
    this.retryable = error.retryable === true;
    this.suggestedAction = error.suggestedAction;
  }
}

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer: number;
};

const toWebSocketUrl = () => {
  const runtime = getDesktopRuntime();
  if (runtime.hostKind === "browser") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/api/webbridge`;
  }

  const url = new URL(runtime.backendUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/webbridge`;
  url.search = "";
  url.hash = "";
  return url.toString();
};

export class WebBridgeClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  private manuallyClosed = true;
  private authRequired = false;
  private expiredToken: string | null = null;
  private connecting: Promise<void> | null = null;
  private connectionSequence = 0;
  private sequence = 0;
  private pending = new Map<string, PendingRequest>();
  private statusListeners = new Set<(status: WebBridgeStatus) => void>();
  private capabilities: unknown[] = [];

  onStatus(listener: (status: WebBridgeStatus) => void) {
    this.statusListeners.add(listener);
    if (this.statusListeners.size === 1 && this.manuallyClosed && !this.authRequired) {
      void this.connect().catch(() => {});
    }
    return () => this.statusListeners.delete(listener);
  }

  private emit(status: WebBridgeStatus) {
    for (const listener of this.statusListeners) listener(status);
  }

  get connected() {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  async connect() {
    if (this.connected) return;
    const currentToken = getSession()?.token || "";
    if (this.authRequired && (!currentToken || currentToken === this.expiredToken)) {
      throw new Error("触界授权已失效，请重新登录后再连接");
    }
    if (this.authRequired) this.authRequired = false;
    if (this.connecting) return this.connecting;
    this.manuallyClosed = false;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocket();
    this.emit({ status: "connecting" });

    const socket = new WebSocket(toWebSocketUrl());
    this.socket = socket;
    const sequence = ++this.connectionSequence;

    const connection = new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.close();
        reject(new Error("连接触界服务超时"));
      }, 5000);

      socket.onopen = () => {
        const token = getSession()?.token;
        socket.send(JSON.stringify({
          version: 1,
          type: "hello",
          client: "mira-webbridge-ui",
          accessToken: token,
        }));
      };

        socket.onmessage = (event) => {
        let message: Record<string, unknown>;
        try {
          message = JSON.parse(String(event.data)) as Record<string, unknown>;
        } catch {
          return;
        }

        if (message.type === "hello_ack") {
          this.reconnectAttempts = 0;
          if (!settled) {
            settled = true;
            window.clearTimeout(timer);
            resolve();
          }
          this.emit({
            status: "connected",
            extensionConnected: message.extensionConnected === true,
            transport: message.transport === "native" ? "native" : message.transport === "websocket" ? "websocket" : undefined,
            tools: Array.isArray(message.tools) ? message.tools : [],
            protocolVersion: typeof message.protocolVersion === "number" ? message.protocolVersion : undefined,
            extensionVersion: typeof message.extensionVersion === "string" ? message.extensionVersion : undefined,
            minExtensionVersion: typeof message.minExtensionVersion === "string" ? message.minExtensionVersion : undefined,
            capabilities: Array.isArray(message.capabilities) ? message.capabilities : [],
          });
          this.capabilities = Array.isArray(message.capabilities) ? message.capabilities : [];
          return;
        }

        if (message.type === "status") {
          const bridgeStatus = message.status === "connecting" || message.status === "disconnected" || message.status === "error"
            ? message.status
            : "connected";
          this.emit({
            status: bridgeStatus,
            extensionConnected: message.extensionConnected === true,
            transport: message.transport === "native" ? "native" : message.transport === "websocket" ? "websocket" : undefined,
            tools: Array.isArray(message.tools) ? message.tools : [],
            event: message.event === "started" || message.event === "finished" ? message.event : undefined,
            tabId: typeof message.tabId === "number" ? message.tabId : undefined,
            operation: typeof message.operation === "string" ? message.operation : undefined,
            operationOk: typeof message.ok === "boolean" ? message.ok : undefined,
            operationError: typeof message.error === "string" ? message.error : undefined,
            capabilities: Array.isArray(message.capabilities) ? message.capabilities : this.capabilities,
          });
          if (Array.isArray(message.capabilities)) this.capabilities = message.capabilities;
          return;
        }

        const messageError = message.error && typeof message.error === "object"
          ? message.error as { code?: unknown; message?: unknown }
          : null;
        if (message.type === "response" && messageError?.code === "AUTH_REQUIRED") {
          const authErrorMessage = String(messageError.message || "触界授权已失效，请重新登录");
          this.authRequired = true;
          this.expiredToken = getSession()?.token || null;
          this.manuallyClosed = true;
          notifyAuthRequired(authErrorMessage);
          this.emit({ status: "error", code: "AUTH_REQUIRED", message: authErrorMessage });
          if (!settled) {
            settled = true;
            window.clearTimeout(timer);
            reject(new Error("触界授权已失效，请重新登录"));
          }
          this.closeSocket();
          this.rejectPending(new Error("触界授权已失效，请重新登录"));
          return;
        }

        if (message.type !== "response" || typeof message.id !== "string") return;
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        window.clearTimeout(request.timer);
        const response = message as unknown as WebBridgeResponse;
        if (response.ok === false && response.error) request.reject(new WebBridgeRequestError(response.error));
        else request.resolve(response.result);
      };

      socket.onerror = () => {
        if (this.socket !== socket || sequence !== this.connectionSequence) return;
        this.emit({ status: "error", code: "BRIDGE_CONNECTION_ERROR", message: "无法连接触界服务" });
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          reject(new Error("无法连接触界服务"));
        }
      };

      socket.onclose = () => {
        if (this.socket !== socket || sequence !== this.connectionSequence) return;
        this.socket = null;
        this.emit({ status: "disconnected", extensionConnected: false });
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          reject(new Error("触界服务已断开"));
        }
        for (const request of this.pending.values()) {
          window.clearTimeout(request.timer);
          request.reject(new Error("触界服务已断开"));
        }
        this.pending.clear();
        if (!this.authRequired) this.scheduleReconnect();
      };
    });
    this.connecting = connection;
    try {
      await connection;
    } finally {
      if (this.connecting === connection) this.connecting = null;
    }
  }

  private rejectPending(reason: Error) {
    for (const request of this.pending.values()) {
      window.clearTimeout(request.timer);
      request.reject(reason);
    }
    this.pending.clear();
  }

  private closeSocket() {
    const socket = this.socket;
    this.socket = null;
    this.connectionSequence += 1;
    if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  }

  private scheduleReconnect() {
    if (this.manuallyClosed || this.authRequired || this.reconnectTimer !== null || this.connecting !== null) return;
    const delay = Math.min(1000 * (2 ** Math.min(this.reconnectAttempts, 5)), 30000);
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect().catch(() => this.scheduleReconnect());
    }, delay);
  }

  request(tool: "look" | "browse" | "act" | "transfer", params: Record<string, unknown>) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("触界服务未连接"));
    }
    const id = `ui_${Date.now()}_${++this.sequence}`;
    return new Promise<unknown>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("浏览器工具调用超时"));
      }, 30000);
        this.pending.set(id, { resolve, reject, timer });
      this.socket?.send(JSON.stringify({ version: 1, type: "request", id, tool, params }));
    });
  }

  async requestClipRules(command: "clip_rules_get" | "clip_rules_set", clipRules?: ClipRules) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("触界服务未连接");
    }
    const id = `ui_clip_rules_${Date.now()}_${++this.sequence}`;
    return new Promise<ClipRules>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("剪藏规则同步超时"));
      }, 10000);
      this.pending.set(id, {
        resolve: (value) => {
          const result = value && typeof value === "object" && "clipRules" in value
            ? (value as { clipRules: ClipRules }).clipRules
            : {};
          resolve(result || {});
        },
        reject,
        timer,
      });
      const payload: Record<string, unknown> = { version: 1, type: "control", command, id };
      if (command === "clip_rules_set") payload.clipRules = clipRules || {};
      this.socket?.send(JSON.stringify(payload));
    });
  }

  async pickClipRegion(kind: "include" | "exclude") {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("触界服务未连接");
    }
    const id = `ui_clip_region_${Date.now()}_${++this.sequence}`;
    return new Promise<ClipRegionPickResult>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("区域选择等待超时，请返回 Mira 后重试"));
      }, 120000);
      this.pending.set(id, { resolve: (value) => resolve(value as ClipRegionPickResult), reject, timer });
      this.socket?.send(JSON.stringify({ version: 1, type: "control", command: "clip_region_pick", id, kind }));
    });
  }

  setTransport(transport: "websocket" | "native") {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error("触界服务未连接"));
    this.socket.send(JSON.stringify({ version: 1, type: "control", command: "set_transport", transport }));
    return Promise.resolve();
  }

  close() {
    this.manuallyClosed = true;
    this.reconnectAttempts = 0;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.closeSocket();
    this.emit({ status: "disconnected", extensionConnected: false });
    this.rejectPending(new Error("触界服务已关闭"));
  }

  authorize() {
    this.authRequired = false;
    this.expiredToken = null;
    this.reconnectAttempts = 0;
  }
}
