import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const hostPath = fileURLToPath(new URL("./host.mjs", import.meta.url));

function frame(message) {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

function readFrame(stream, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0);
    const cleanup = () => {
      clearTimeout(timer);
      stream.off("data", onData);
      stream.off("end", onEnd);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("等待 Native Host 消息超时"));
    }, timeoutMs);
    const onEnd = () => {
      cleanup();
      reject(new Error("Native Host 在返回消息前结束"));
    };
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 4) return;
      const length = buffer.readUInt32LE(0);
      if (buffer.length < length + 4) return;
      cleanup();
      resolve(JSON.parse(buffer.subarray(4, length + 4).toString("utf8")));
    };
    stream.on("data", onData);
    stream.on("end", onEnd);
  });
}

test("Native Host acknowledges Chrome transport before backend validation", async () => {
  const child = spawn(process.execPath, [hostPath], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stderr.resume();
  try {
    child.stdin.write(frame({ type: "hello", backendUrl: "not-a-url", accessToken: "test-token" }));
    const message = await readFrame(child.stdout);
    assert.equal(message.type, "status");
    assert.equal(message.status, "native_ready");
    assert.equal(message.code, "NATIVE_HOST_READY");
  } finally {
    child.stdin.destroy();
    child.stdout.destroy();
    child.stderr.destroy();
    child.kill();
  }
});

test("Native Host source keeps backend reconnect separate from native readiness", async () => {
  const source = await readFile(path.join(path.dirname(hostPath), "host.mjs"), "utf8");
  assert.match(source, /sendStatus\('native_ready', 'NATIVE_HOST_READY'\)/);
  assert.match(source, /sendStatus\('backend_connecting', 'BACKEND_CONNECTING'\)/);
  assert.match(source, /scheduleBackendReconnect/);
});

test("Native Host source keeps diagnostics out of stdout", async () => {
  const source = await readFile(path.join(path.dirname(hostPath), "host.mjs"), "utf8");
  assert.match(source, /Diagnostics go to stderr/);
  assert.doesNotMatch(source, /stdout\.write\(.*console/);
});
