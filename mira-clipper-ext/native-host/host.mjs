#!/usr/bin/env node

// Native Messaging proxy: Chrome stdin/stdout <-> Mira local IPC.
// Diagnostics go to stderr so Chrome framing remains valid.
import net from "node:net";
import { stdin, stdout } from "node:process";

const PIPE_PATH = process.env.UI_CHAT_WEBBRIDGE_PIPE?.trim()
  || (process.platform === "win32"
    ? "\\\\.\\pipe\\uichat-mira-webbridge-v1"
    : `/tmp/uichat-mira-webbridge-${typeof process.getuid === "function" ? process.getuid() : "user"}.sock`);

let nativeBuffer = Buffer.alloc(0);
let pipeBuffer = "";
let pipeSocket = null;
let config = null;
let terminating = false;
let authRequired = false;
let pipeConnecting = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
let helloTimer = setTimeout(() => terminateHost("NATIVE_HELLO_TIMEOUT"), 5000);

function writeNativeMessage(value) {
  const payload = Buffer.from(JSON.stringify(value), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  stdout.write(Buffer.concat([header, payload]));
}

function sendStatus(status, code, detail = {}) {
  writeNativeMessage({ version: 1, type: "status", status, ...(code ? { code } : {}), ...detail });
}

function writePipeMessage(value) {
  if (!pipeSocket || pipeSocket.destroyed || !pipeSocket.writable) return false;
  pipeSocket.write(`${JSON.stringify(value)}\n`);
  return true;
}

function terminateHost(reason, exitCode = 1) {
  if (terminating) return;
  terminating = true;
  authRequired = false;
  pipeConnecting = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (pipeSocket && !pipeSocket.destroyed) pipeSocket.destroy();
  pipeSocket = null;
  if (reason) sendStatus("disconnected", reason);
  setTimeout(() => process.exit(exitCode), 25);
}

function schedulePipeReconnect() {
  if (terminating || authRequired || reconnectTimer || pipeConnecting || !config) return;
  const delay = Math.min(500 * (2 ** Math.min(reconnectAttempts, 4)), 5000);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectMiraPipe();
  }, delay);
}

function handlePipeMessage(message) {
  writeNativeMessage(message);
  if (message?.type === "response" && message.error?.code === "AUTH_REQUIRED") {
    authRequired = true;
    if (pipeSocket && !pipeSocket.destroyed) pipeSocket.destroy();
  }
}

function consumePipeData(chunk) {
  pipeBuffer += chunk;
  while (true) {
    const newline = pipeBuffer.indexOf("\n");
    if (newline < 0) return;
    const line = pipeBuffer.slice(0, newline).trim();
    pipeBuffer = pipeBuffer.slice(newline + 1);
    if (!line) continue;
    try {
      handlePipeMessage(JSON.parse(line));
    } catch (error) {
      console.error("Invalid Mira pipe message", error);
      sendStatus("mira_connecting", "MIRA_PIPE_INVALID_MESSAGE");
    }
  }
}

function connectMiraPipe() {
  if (terminating || authRequired || pipeSocket || pipeConnecting || !config) return;
  pipeConnecting = true;
  sendStatus("mira_connecting", "MIRA_PIPE_CONNECTING");

  const nextSocket = net.createConnection(PIPE_PATH);
  pipeSocket = nextSocket;
  nextSocket.setEncoding("utf8");

  nextSocket.on("connect", () => {
    if (pipeSocket !== nextSocket || terminating || authRequired) return;
    pipeConnecting = false;
    reconnectAttempts = 0;
    pipeBuffer = "";
    writePipeMessage(config);
  });

  nextSocket.on("data", (chunk) => {
    if (pipeSocket !== nextSocket) return;
    consumePipeData(String(chunk));
  });

  nextSocket.on("close", () => {
    if (pipeSocket !== nextSocket) return;
    pipeSocket = null;
    pipeConnecting = false;
    pipeBuffer = "";
    if (!terminating && !authRequired) {
      sendStatus("mira_connecting", "MIRA_PIPE_DISCONNECTED");
      schedulePipeReconnect();
    }
  });

  nextSocket.on("error", (error) => {
    if (pipeSocket !== nextSocket) return;
    if (!['ENOENT', 'ECONNREFUSED'].includes(String(error?.code || ''))) {
      console.error("Mira pipe connection error", error?.message || error);
    }
  });
}

function consumeNativeData() {
  while (nativeBuffer.length >= 4) {
    const length = nativeBuffer.readUInt32LE(0);
    if (length > 64 * 1024 * 1024) throw new Error("Native Messaging 消息过大");
    if (nativeBuffer.length < length + 4) return;
    const raw = nativeBuffer.subarray(4, length + 4).toString("utf8");
    nativeBuffer = nativeBuffer.subarray(length + 4);
    handleNativeMessage(JSON.parse(raw));
  }
}

function handleNativeMessage(message) {
  if (message?.type === "hello") {
    if (helloTimer) clearTimeout(helloTimer);
    helloTimer = null;
    config = { ...message, transport: "native" };
    authRequired = false;
    reconnectAttempts = 0;
    sendStatus("native_ready", "NATIVE_HOST_READY", { pipePath: PIPE_PATH });
    connectMiraPipe();
    return;
  }

  if (!config) {
    terminateHost("NATIVE_HELLO_REQUIRED");
    return;
  }

  writePipeMessage(message);
}

stdin.on("data", (chunk) => {
  nativeBuffer = Buffer.concat([nativeBuffer, chunk]);
  try {
    consumeNativeData();
  } catch (error) {
    console.error(error);
    terminateHost("INVALID_MESSAGE");
  }
});

stdin.on("end", () => {
  if (helloTimer) clearTimeout(helloTimer);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pipeSocket && !pipeSocket.destroyed) pipeSocket.destroy();
  process.exit(0);
});
