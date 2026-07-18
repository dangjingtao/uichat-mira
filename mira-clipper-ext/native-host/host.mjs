#!/usr/bin/env node

// Native Messaging host: stdin/stdout carry length-prefixed JSON only.
// Diagnostics go to stderr so Chrome framing remains valid.
import { stdin, stdout } from "node:process";

let buffer = Buffer.alloc(0);
let socket = null;
let config = null;
let terminating = false;
let authRequired = false;
let authStatusSent = false;
let backendConfigInvalid = false;
let backendConnecting = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let helloTimer = setTimeout(() => terminateHost("NATIVE_HELLO_TIMEOUT"), 5000);

function getBackendUrl(value) {
  const backend = new URL(value);
  if (backend.protocol !== "http:" && backend.protocol !== "https:") {
    throw new Error("Mira 后端地址必须使用 HTTP 或 HTTPS");
  }
  backend.protocol = backend.protocol === "https:" ? "wss:" : "ws:";
  backend.pathname = `${backend.pathname.replace(/\/$/, "")}/webbridge`;
  return backend;
}

function writeMessage(value) {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  stdout.write(Buffer.concat([header, payload]));
}

function sendToBackend(value) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value));
}

function sendStatus(status, code, detail = {}) {
  writeMessage({ version: 1, type: "status", status, ...(code ? { code } : {}), ...detail });
}

function terminateHost(reason, exitCode = 1) {
  if (terminating) return;
  terminating = true;
  authRequired = false;
  authStatusSent = false;
  backendConnecting = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  if (reason) writeMessage({ version: 1, type: 'status', status: 'disconnected', code: reason });
  setTimeout(() => process.exit(exitCode), 25);
}

function scheduleBackendReconnect() {
  if (terminating || authRequired || backendConfigInvalid || reconnectTimer || backendConnecting || !config) return;
  const delay = Math.min(1000 * (2 ** Math.min(reconnectAttempts, 5)), 30000);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectBackend();
  }, delay);
}

async function connectBackend() {
  if (terminating || authRequired || socket || backendConnecting || !config) return;
  if (!config.backendUrl || !config.accessToken) {
    sendStatus('error', 'NATIVE_CONFIG_REQUIRED');
    return;
  }
  backendConnecting = true;
  sendStatus('backend_connecting', 'BACKEND_CONNECTING');
  try {
    const backend = getBackendUrl(config.backendUrl);
    const nextSocket = new WebSocket(backend);
    socket = nextSocket;
    nextSocket.addEventListener("open", () => {
      if (socket !== nextSocket || terminating || authRequired) return;
      reconnectAttempts = 0;
      sendToBackend({
        version: 1,
        protocolVersion: 1,
        type: "hello",
        client: "mira-webbridge-extension",
        extensionName: "见行",
        extensionVersion: config.extensionVersion || "unknown",
        accessToken: config.accessToken,
        transport: "native",
        capabilities: ["look", "browse", "act", "transfer"],
        tools: config.tools || [],
      });
    });
    nextSocket.addEventListener("message", (event) => {
      let message;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        sendStatus('error', 'BACKEND_INVALID_MESSAGE');
        return;
      }
      writeMessage(message);
      if (message?.type === "response" && message.error?.code === "AUTH_REQUIRED") {
        authRequired = true;
        if (!authStatusSent) {
          authStatusSent = true;
          sendStatus('auth_required', 'AUTH_REQUIRED');
        }
        if (nextSocket.readyState !== WebSocket.CLOSED) nextSocket.close();
      }
    });
    nextSocket.addEventListener("close", () => {
      if (socket !== nextSocket) return;
      socket = null;
      if (authRequired) {
        if (!authStatusSent) {
          authStatusSent = true;
          sendStatus('auth_required', 'AUTH_REQUIRED');
        }
      } else {
        sendStatus('backend_connecting', 'BRIDGE_DISCONNECTED');
      }
      scheduleBackendReconnect();
    });
    nextSocket.addEventListener("error", () => {
      if (socket !== nextSocket) return;
      sendStatus('backend_connecting', 'BRIDGE_CONNECTION_ERROR');
    });
  } catch (error) {
    backendConfigInvalid = true;
    sendStatus('error', error?.code || 'BRIDGE_CONNECTION_ERROR', { message: error?.message || '无法创建 Mira backend 连接' });
    if (socket) socket = null;
  } finally {
    backendConnecting = false;
    if (!socket && !authRequired) scheduleBackendReconnect();
  }
}

function consume() {
  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    if (length > 16 * 1024 * 1024) throw new Error("Native Messaging 消息过大");
    if (buffer.length < length + 4) return;
    const raw = buffer.subarray(4, length + 4).toString("utf8");
    buffer = buffer.subarray(length + 4);
    void handle(JSON.parse(raw)).catch((error) => {
      console.error(error);
      terminateHost("NATIVE_HOST_ERROR");
    });
  }
}

async function handle(message) {
  if (message?.type === "hello") {
    clearTimeout(helloTimer);
    helloTimer = null;
    config = message;
    authRequired = false;
    authStatusSent = false;
    backendConfigInvalid = false;
    reconnectAttempts = 0;
    // The Chrome <-> Native Host port is ready independently of Mira backend readiness.
    // A backend outage must not make the extension tear down this long-lived native port.
    sendStatus('native_ready', 'NATIVE_HOST_READY');
    await connectBackend();
    return;
  }
  if (!config) {
    terminateHost("NATIVE_HELLO_REQUIRED");
    return;
  }
  sendToBackend(message);
}

stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  try { consume(); } catch (error) { console.error(error); terminateHost("INVALID_MESSAGE"); }
});
stdin.on("end", () => {
  if (helloTimer) clearTimeout(helloTimer);
  process.exit(0);
});