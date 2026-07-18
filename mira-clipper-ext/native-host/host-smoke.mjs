import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const hostPath = fileURLToPath(new URL("./host.mjs", import.meta.url));

function frame(message) {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

function createFrameReader(stream) {
  let buffer = Buffer.alloc(0);
  const queue = [];
  const waiters = [];

  const flush = () => {
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (buffer.length < length + 4) return;
      const value = JSON.parse(buffer.subarray(4, length + 4).toString("utf8"));
      buffer = buffer.subarray(length + 4);
      const waiter = waiters.shift();
      if (waiter) waiter.resolve(value);
      else queue.push(value);
    }
  };

  stream.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    flush();
  });

  return async function nextFrame(timeoutMs = 5000) {
    if (queue.length > 0) return queue.shift();
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      waiters.push(waiter);
      const timer = setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        reject(new Error("等待 Native Host 消息超时"));
      }, timeoutMs);
      waiter.resolve = (value) => {
        clearTimeout(timer);
        resolve(value);
      };
    });
  };
}

function createLineReader(socket) {
  let buffer = "";
  const queue = [];
  const waiters = [];

  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline < 0) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      const value = JSON.parse(line);
      const waiter = waiters.shift();
      if (waiter) waiter(value);
      else queue.push(value);
    }
  });

  return async function nextLine(timeoutMs = 5000) {
    if (queue.length > 0) return queue.shift();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("等待 Mira pipe 消息超时")), timeoutMs);
      waiters.push((value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
  };
}

async function nextMatching(nextFrame, predicate, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const message = await nextFrame(Math.max(100, deadline - Date.now()));
    if (predicate(message)) return message;
  }
  throw new Error("未收到匹配的 Native Host 消息");
}

test("Native Host keeps Chrome attached and bridges Mira over local IPC", async () => {
  const pipePath = process.platform === "win32"
    ? `\\\\.\\pipe\\uichat-mira-webbridge-test-${process.pid}-${Date.now()}`
    : path.join(os.tmpdir(), `uichat-mira-webbridge-test-${process.pid}-${Date.now()}.sock`);
  const child = spawn(process.execPath, [hostPath], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, UI_CHAT_WEBBRIDGE_PIPE: pipePath },
  });
  const nextNativeFrame = createFrameReader(child.stdout);
  child.stderr.resume();
  let server;
  let serverSocket;

  try {
    child.stdin.write(frame({
      version: 1,
      protocolVersion: 1,
      type: "hello",
      client: "mira-webbridge-extension",
      extensionVersion: "0.7.1",
      accessToken: "test-token",
      transport: "native",
      tools: [],
    }));

    const nativeReady = await nextNativeFrame();
    assert.equal(nativeReady.type, "status");
    assert.equal(nativeReady.status, "native_ready");

    server = net.createServer((socket) => { serverSocket = socket; });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(pipePath, resolve);
    });

    const connected = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Native Host 未连接 Mira pipe")), 5000);
      const poll = () => {
        if (serverSocket) {
          clearTimeout(timer);
          resolve(serverSocket);
          return;
        }
        setTimeout(poll, 25);
      };
      poll();
    });
    const nextPipeLine = createLineReader(connected);

    const hello = await nextPipeLine();
    assert.equal(hello.type, "hello");
    assert.equal(hello.transport, "native");

    connected.write(`${JSON.stringify({ version: 1, type: "hello_ack", transport: "native", tools: [] })}\n`);
    const helloAck = await nextMatching(nextNativeFrame, (message) => message?.type === "hello_ack");
    assert.equal(helloAck.transport, "native");

    connected.write(`${JSON.stringify({ version: 1, type: "request", id: "req-1", tool: "look", params: {} })}\n`);
    const request = await nextMatching(nextNativeFrame, (message) => message?.type === "request");
    assert.equal(request.id, "req-1");

    child.stdin.write(frame({ version: 1, type: "response", id: "req-1", ok: true, result: { title: "ok" } }));
    const response = await nextPipeLine();
    assert.equal(response.type, "response");
    assert.equal(response.id, "req-1");
    assert.deepEqual(response.result, { title: "ok" });
  } finally {
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    child.kill();
    if (serverSocket && !serverSocket.destroyed) serverSocket.destroy();
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
    if (process.platform !== "win32") await rm(pipePath, { force: true });
  }
});

test("Native Host is a local IPC proxy, not a backend WebSocket client", async () => {
  const source = await readFile(path.join(path.dirname(hostPath), "host.mjs"), "utf8");
  assert.match(source, /node:net/);
  assert.match(source, /MIRA_PIPE_CONNECTING/);
  assert.match(source, /sendStatus\("native_ready", "NATIVE_HOST_READY"/);
  assert.doesNotMatch(source, /new WebSocket|\/webbridge/);
});

test("Native Host keeps diagnostics out of stdout", async () => {
  const source = await readFile(path.join(path.dirname(hostPath), "host.mjs"), "utf8");
  assert.match(source, /Diagnostics go to stderr/);
  assert.doesNotMatch(source, /stdout\.write\(.*console/);
});
