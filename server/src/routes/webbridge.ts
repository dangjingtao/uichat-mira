import type { FastifyPluginAsync } from "fastify";
import { verifyAccessToken } from "@/db/auth.db.js";
import crypto from "node:crypto";

type WebBridgeSocket = {
  readyState: number;
  send(payload: string): void;
  close(): void;
  on(event: "message" | "close" | "error", listener: (...args: unknown[]) => void): void;
};

type WebBridgeClient = {
  id: string;
  socket: WebBridgeSocket;
  role: "unknown" | "extension" | "ui";
  authenticated: boolean;
  userId?: number;
  transport?: "websocket" | "native";
  cleanedUp?: boolean;
};

type PendingRequest = {
  client?: WebBridgeClient;
  userId?: number;
  originalId: string;
  resolve?: (value: unknown) => void;
  reject?: (error: Error) => void;
  timer?: ReturnType<typeof setTimeout>;
};

const PROTOCOL_VERSION = 1;
const MIN_EXTENSION_VERSION = "0.7.1";
const HELLO_TIMEOUT_MS = 5000;
const clients = new Map<string, WebBridgeClient>();
const pending = new Map<string, PendingRequest>();
const extensionClients = new Map<number, WebBridgeClient>();
let clientSequence = 0;
let extensionTools: unknown[] = [];

const send = (client: WebBridgeClient, payload: Record<string, unknown>) => {
  if (client.socket.readyState === 1) client.socket.send(JSON.stringify(payload));
};

const sendError = (client: WebBridgeClient, id: string | null, code: string, message: string) => {
  send(client, {
    version: PROTOCOL_VERSION,
    type: "response",
    id,
    ok: false,
    error: { code, message, retryable: false },
  });
};

const broadcastStatus = (status: string) => {
  for (const client of clients.values()) {
    if (client.role !== "ui" || !client.authenticated) continue;
    send(client, {
      version: PROTOCOL_VERSION,
      type: "status",
      status,
      extensionConnected: client.userId !== undefined && extensionClients.has(client.userId),
      transport: client.userId === undefined ? undefined : extensionClients.get(client.userId)?.transport,
      tools: extensionTools,
    });
  }
};

export const invokeWebBridge = (input: {
  userId: number;
  tool: string;
  params: Record<string, unknown>;
  signal?: AbortSignal;
}) => new Promise<unknown>((resolve, reject) => {
  const extensionClient = extensionClients.get(input.userId);
  if (!extensionClient) {
    reject(new Error("见行扩展尚未连接"));
    return;
  }
  const id = `server_${crypto.randomUUID()}`;
  const relayId = `${extensionClient.id}:${id}`;
  const pendingRequest: PendingRequest = { userId: input.userId, originalId: id, resolve, reject };
  pending.set(relayId, pendingRequest);
  send(extensionClient, { version: PROTOCOL_VERSION, type: "request", id: relayId, tool: input.tool, params: input.params });
  const timer = setTimeout(() => {
    if (pending.delete(relayId)) reject(new Error("见行浏览器操作超时"));
  }, 30_000);
  pendingRequest.timer = timer;
  const abort = () => {
    clearTimeout(timer);
    if (pending.delete(relayId)) reject(new Error("见行浏览器操作已取消"));
  };
  input.signal?.addEventListener("abort", abort, { once: true });
});

const parseMessage = (raw: unknown): Record<string, unknown> | null => {
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw ?? "");
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
};

const authenticate = (token: unknown) =>
  typeof token === "string" && token.length > 0 ? verifyAccessToken(token) : null;

const webbridgeRoute: FastifyPluginAsync = async (app) => {
  app.get("/webbridge", { websocket: true }, (connection) => {
    const socket = connection.socket as unknown as WebBridgeSocket;
    const client: WebBridgeClient = {
      id: `webbridge_${++clientSequence}`,
      socket,
      role: "unknown",
      authenticated: false,
    };
    clients.set(client.id, client);

    const helloTimer = setTimeout(() => {
      if (client.role === "unknown") client.socket.close();
    }, HELLO_TIMEOUT_MS);

    socket.on("message", (raw) => {
      const message = parseMessage(raw);
      if (!message) {
        sendError(client, null, "INVALID_MESSAGE", "WebSocket 消息不是合法 JSON");
        return;
      }

      if (client.role === "unknown") {
        if (message.type !== "hello") {
          sendError(client, null, "HELLO_REQUIRED", "连接必须先发送 hello");
          client.socket.close();
          return;
        }
        clearTimeout(helloTimer);
        const user = authenticate(message.accessToken);
        if (!user) {
          sendError(client, null, "AUTH_REQUIRED", "WebBridge 需要有效的 Mira 授权令牌");
          client.socket.close();
          return;
        }
        client.authenticated = true;
        client.userId = user.id;
        if (message.client === "mira-webbridge-extension") {
          const extensionVersion = typeof message.extensionVersion === "string" ? message.extensionVersion : "unknown";
          const protocolVersion = Number(message.protocolVersion ?? message.version);
          if (protocolVersion !== PROTOCOL_VERSION) {
            sendError(client, null, "PROTOCOL_VERSION_UNSUPPORTED", `见行协议版本不兼容，需要协议 ${PROTOCOL_VERSION}`,);
            client.socket.close();
            return;
          }
          client.role = "extension";
          client.transport = message.transport === "native" ? "native" : "websocket";
          const existingExtension = extensionClients.get(user.id);
          if (existingExtension && existingExtension !== client) existingExtension.socket.close();
          extensionClients.set(user.id, client);
          extensionTools = Array.isArray(message.tools) ? message.tools : [];
          send(client, { version: PROTOCOL_VERSION, type: "hello_ack", role: "host", protocolVersion: PROTOCOL_VERSION, minExtensionVersion: MIN_EXTENSION_VERSION, extensionVersion, transport: client.transport, tools: extensionTools });
          broadcastStatus("extension_connected");
          return;
        }
        if (message.client === "mira-webbridge-ui") {
          client.role = "ui";
          send(client, {
            version: PROTOCOL_VERSION,
            type: "hello_ack",
            role: "ui",
            extensionConnected: extensionClients.has(user.id),
            transport: extensionClients.get(user.id)?.transport,
            tools: extensionTools,
          });
          return;
        }
        sendError(client, null, "INVALID_CLIENT", "未知的 WebBridge 客户端类型");
        client.socket.close();
        return;
      }

      if (!client.authenticated) return;

      if (client.role === "ui" && message.type === "request") {
        const extensionClient = client.userId === undefined ? null : extensionClients.get(client.userId);
        if (!extensionClient) {
          sendError(client, typeof message.id === "string" ? message.id : null, "BRIDGE_DISCONNECTED", "见行扩展尚未连接");
          return;
        }
        if (typeof message.id !== "string" || typeof message.tool !== "string") {
          sendError(client, typeof message.id === "string" ? message.id : null, "INVALID_REQUEST", "工具请求缺少 id 或 tool");
          return;
        }
        const relayId = `${client.id}:${message.id}`;
        pending.set(relayId, { client, userId: client.userId, originalId: message.id });
        send(extensionClient, { ...message, id: relayId, version: PROTOCOL_VERSION });
        return;
      }

      if (client.role === "ui" && message.type === "control" && message.command === "set_transport") {
        const extensionClient = client.userId === undefined ? null : extensionClients.get(client.userId);
        if (!extensionClient || !["websocket", "native"].includes(String(message.transport))) {
          sendError(client, null, "INVALID_TRANSPORT", "连接方式不可用或见行扩展未连接");
          return;
        }
        send(extensionClient, { version: PROTOCOL_VERSION, type: "control", command: "set_transport", transport: message.transport });
        return;
      }

      if (client.role === "extension" && message.type === "response" && typeof message.id === "string") {
        const request = pending.get(message.id);
        if (!request) return;
        pending.delete(message.id);
        if (request.client) {
          send(request.client, { ...message, id: request.originalId, version: PROTOCOL_VERSION });
        } else if (message.ok === false) {
          if (request.timer) clearTimeout(request.timer);
          request.reject?.(new Error(String((message.error as Record<string, unknown> | undefined)?.message ?? "见行浏览器操作失败")));
        } else {
          if (request.timer) clearTimeout(request.timer);
          request.resolve?.(message.result);
        }
      }

      if (client.role === "extension" && message.type === "status") {
        for (const uiClient of clients.values()) {
          if (uiClient.role !== "ui" || uiClient.userId !== client.userId || !uiClient.authenticated) continue;
          send(uiClient, { ...message, type: "status", extensionConnected: true, transport: client.transport, tools: extensionTools });
        }
      }
    });

    const cleanup = () => {
      if (client.cleanedUp) return;
      client.cleanedUp = true;
      clearTimeout(helloTimer);
      clients.delete(client.id);
      for (const [id, request] of pending) {
        if (request.client === client || (client.role === "extension" && request.userId === client.userId)) {
          pending.delete(id);
          if (request.client && request.client !== client) {
            sendError(request.client, request.originalId, "BRIDGE_DISCONNECTED", "见行扩展已断开");
          } else if (!request.client) {
            if (request.timer) clearTimeout(request.timer);
            request.reject?.(new Error("见行扩展已断开"));
          }
        }
      }
      if (client.userId !== undefined && extensionClients.get(client.userId) === client) {
        extensionClients.delete(client.userId);
        extensionTools = [];
        broadcastStatus("extension_disconnected");
      }
    };
    socket.on("close", cleanup);
    socket.on("error", cleanup);
  });
};

export default webbridgeRoute;
