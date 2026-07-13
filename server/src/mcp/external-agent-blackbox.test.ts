import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { afterEach, beforeEach, describe, test } from "vitest";
import { createInvocationInputHash } from "@/agent/approval-fingerprint";
import { executeHarnessInvocation } from "@/harness/invocations";
import { clearHarnessRegistry } from "@/harness/registry";
import {
  clearExternalMcpServers,
  connectExternalMcpServer,
  createExternalMcpServer,
  discoverExternalMcpServer,
  getExternalMcpServer,
  initializeExternalMcpDatabase,
  registerAllExternalMcpCapabilities,
  resolveAgentEligibleExternalMcpCapabilities,
  updateExternalMcpServerConfig,
  updateExternalMcpAccess,
} from "./external.js";

const dbPath = `.test-artifact/external-agent-blackbox-${crypto.randomUUID()}.sqlite`;

type RemoteMode = "success" | "rpc-error" | "empty-result" | "stale-once" | "stale-always" | "timeout";

const jsonResponse = (body: unknown, headers: Record<string, string> = {}) => ({
  statusCode: 200,
  headers: {
    "content-type": "application/json",
    "mcp-session-id": "remote-session",
    ...headers,
  },
  body: JSON.stringify(body),
});

const startRemoteMcp = async (mode: RemoteMode) => {
  let toolsCallCount = 0;
  let initializeCount = 0;
  let listCount = 0;
  let currentMode = mode;
  const server = http.createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const message = body ? (JSON.parse(body) as { method?: string }) : { method: undefined };
    let result: ReturnType<typeof jsonResponse>;

    if (message.method === "initialize") {
      initializeCount += 1;
      result = jsonResponse({
        jsonrpc: "2.0",
        id: "initialize",
        result: {
          protocolVersion: "2025-06-18",
          serverInfo: { name: "blackbox", version: "1.0.0" },
          capabilities: { tools: {} },
        },
      });
    } else if (message.method === "notifications/initialized") {
      response.writeHead(202);
      response.end();
      return;
    } else if (message.method === "tools/list") {
      listCount += 1;
      result = jsonResponse({
        jsonrpc: "2.0",
        id: "tools-list",
        result: {
          tools: listCount > 1 && currentMode === "empty-result"
            ? []
            : [{
                name: "health_check",
                title: "Health Check",
                description: "Read-only health check",
                inputSchema: { type: "object", additionalProperties: false },
              }],
        },
      });
    } else if (message.method === "tools/call") {
      toolsCallCount += 1;
      if (currentMode === "timeout") {
        await new Promise((resolve) => setTimeout(resolve, 100));
        result = jsonResponse({
          jsonrpc: "2.0",
          id: "tools-call",
          result: { content: [{ type: "text", text: "late response" }] },
        });
      } else if (currentMode === "stale-once" && toolsCallCount === 1 || currentMode === "stale-always") {
        result = { statusCode: 404, headers: {}, body: "stale session" };
      } else if (currentMode === "rpc-error") {
        result = jsonResponse({
          jsonrpc: "2.0",
          id: "tools-call",
          error: { code: -32000, message: "remote tool failed token=secret-value" },
        });
      } else if (currentMode === "empty-result") {
        result = jsonResponse({ jsonrpc: "2.0", id: "tools-call" });
      } else {
        result = jsonResponse({
          jsonrpc: "2.0",
          id: "tools-call",
          result: {
            content: [{ type: "text", text: "healthy token=secret-value" }],
            secret: "secret-value",
          },
        });
      }
    } else {
      result = jsonResponse({ jsonrpc: "2.0", id: "unknown", result: {} });
    }

    response.writeHead(result.statusCode, result.headers);
    response.end(result.body);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
    stats: () => ({ toolsCallCount, initializeCount, listCount }),
    setMode: (next: RemoteMode) => { currentMode = next; },
  };
};

describe("external MCP Agent blackbox", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = `file:${dbPath}`;
    initializeExternalMcpDatabase();
    clearExternalMcpServers();
    clearHarnessRegistry();
  });

  afterEach(() => {
    clearExternalMcpServers();
    clearHarnessRegistry();
    delete process.env.DATABASE_URL;
  });

  test("runs record -> connect -> discover -> Agent Access -> approval -> tools/call exactly once", async () => {
    const remote = await startRemoteMcp("success");
    try {
      const created = createExternalMcpServer({
        id: "blackbox-http",
        displayName: "Blackbox HTTP",
        transport: { kind: "streamable-http", url: remote.url },
        disclaimerAccepted: true,
      });
      await connectExternalMcpServer(created.id);
      await discoverExternalMcpServer(created.id);
      updateExternalMcpAccess(created.id, { agentEnabled: true });
      registerAllExternalMcpCapabilities();

      const toolId = "mcp:blackbox-http:tool:health_check";
      assert.deepEqual(resolveAgentEligibleExternalMcpCapabilities().map((tool) => tool.id), [toolId]);
      const args = {};
      const first = await executeHarnessInvocation({ toolId, args });
      assert.equal(first.status, "awaiting_approval");
      assert.equal(remote.stats().toolsCallCount, 0);

      const second = await executeHarnessInvocation({
        toolId,
        args,
        approvedInvocations: [{ toolId, inputHash: createInvocationInputHash(args) }],
      });
      assert.equal(second.status, "completed");
      assert.equal(remote.stats().toolsCallCount, 1);
      assert.equal(JSON.stringify(second).includes("secret-value"), false);
    } finally {
      await remote.close();
    }
  });

  test.each([
    ["stale-once", 2, "completed"],
    ["stale-always", 2, "failed"],
    ["rpc-error", 1, "failed"],
    ["empty-result", 1, "failed"],
  ] as const)("keeps %s bounded with %d tools/call attempt(s)", async (mode, expectedCalls, expectedStatus) => {
    const remote = await startRemoteMcp(mode);
    try {
      const created = createExternalMcpServer({
        id: `blackbox-${mode}`,
        displayName: `Blackbox ${mode}`,
        transport: { kind: "streamable-http", url: remote.url },
        disclaimerAccepted: true,
      });
      await connectExternalMcpServer(created.id);
      await discoverExternalMcpServer(created.id);
      updateExternalMcpAccess(created.id, { agentEnabled: true });
      registerAllExternalMcpCapabilities();
      const toolId = `mcp:blackbox-${mode}:tool:health_check`;
      const invocation = await executeHarnessInvocation({
        toolId,
        args: {},
        approvedInvocations: [{ toolId, inputHash: createInvocationInputHash({}) }],
      });
      assert.equal(invocation.status, expectedStatus);
      assert.equal(remote.stats().toolsCallCount, expectedCalls);
      if (mode === "stale-always") {
        assert.match(invocation.error?.message ?? "", /recovery exhausted/i);
      }
    } finally {
      await remote.close();
    }
  });

  test("returns a bounded timeout failure without retrying a healthy request", async () => {
    const remote = await startRemoteMcp("timeout");
    try {
      const created = createExternalMcpServer({
        id: "blackbox-timeout",
        displayName: "Blackbox timeout",
        transport: { kind: "streamable-http", url: remote.url },
        disclaimerAccepted: true,
      });
      updateExternalMcpServerConfig(created.id, {
        endpointUrl: remote.url,
        timeoutMs: 20,
        authType: "none",
        customHeadersJson: "{}",
        envJson: "{}",
      });
      await connectExternalMcpServer(created.id);
      await discoverExternalMcpServer(created.id);
      updateExternalMcpAccess(created.id, { agentEnabled: true });
      registerAllExternalMcpCapabilities();
      const invocation = await executeHarnessInvocation({
        toolId: "mcp:blackbox-timeout:tool:health_check",
        args: {},
        approvedInvocations: [{
          toolId: "mcp:blackbox-timeout:tool:health_check",
          inputHash: createInvocationInputHash({}),
        }],
      });
      assert.equal(invocation.status, "failed");
      assert.equal(remote.stats().toolsCallCount, 1);
      assert.match(invocation.error?.message ?? "", /timeout/i);
    } finally {
      await remote.close();
    }
  });

  test("revoked Agent Access blocks an old approved call before remote execution", async () => {
    const remote = await startRemoteMcp("success");
    try {
      const created = createExternalMcpServer({
        id: "blackbox-revoked",
        displayName: "Blackbox Revoked",
        transport: { kind: "streamable-http", url: remote.url },
        disclaimerAccepted: true,
      });
      await connectExternalMcpServer(created.id);
      await discoverExternalMcpServer(created.id);
      updateExternalMcpAccess(created.id, { agentEnabled: true });
      registerAllExternalMcpCapabilities();
      const toolId = "mcp:blackbox-revoked:tool:health_check";
      updateExternalMcpAccess(created.id, { agentEnabled: false });
      const invocation = await executeHarnessInvocation({
        toolId,
        args: {},
        approvedInvocations: [{ toolId, inputHash: createInvocationInputHash({}) }],
      });
      assert.equal(invocation.status, "failed");
      assert.equal(remote.stats().toolsCallCount, 0);
    } finally {
      await remote.close();
    }
  });

  test("rediscover removes an old projected tool before an old approved call", async () => {
    const remote = await startRemoteMcp("success");
    try {
      const created = createExternalMcpServer({
        id: "blackbox-rediscover",
        displayName: "Blackbox Rediscover",
        transport: { kind: "streamable-http", url: remote.url },
        disclaimerAccepted: true,
      });
      await connectExternalMcpServer(created.id);
      await discoverExternalMcpServer(created.id);
      updateExternalMcpAccess(created.id, { agentEnabled: true });
      registerAllExternalMcpCapabilities();
      remote.setMode("empty-result");
      await discoverExternalMcpServer(created.id);
      assert.equal(getExternalMcpServer(created.id).discoveredTools.length, 0);
      const toolId = "mcp:blackbox-rediscover:tool:health_check";
      await assert.rejects(() => executeHarnessInvocation({
        toolId,
        args: {},
        approvedInvocations: [{ toolId, inputHash: createInvocationInputHash({}) }],
      }), /Tool not found/);
      assert.equal(remote.stats().toolsCallCount, 0);
    } finally {
      await remote.close();
    }
  });

  test("restarts a stdio process once after it exits during tools/call", async () => {
    const marker = path.resolve(".test-artifact", `stdio-recovery-${crypto.randomUUID()}.marker`);
    const fixture = path.resolve(".test-artifact", `stdio-recovery-${crypto.randomUUID()}.cjs`);
    const script = [
      "const fs=require('fs');",
      "process.stdin.on('data',chunk=>{const m=JSON.parse(chunk.toString());",
      "if(m.method==='initialize') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'stdio-blackbox'}}})+'\\n');",
      "if(m.method==='tools/list') process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{tools:[{name:'health_check',title:'Health Check',description:'Read-only health check',inputSchema:{type:'object',additionalProperties:false}}]}})+'\\n');",
      "if(m.method==='tools/call'){if(!fs.existsSync(process.argv[1])){fs.writeFileSync(process.argv[1],'1');process.exit(1)}else process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result:{status:'ok'}})+'\\n');}});",
    ].join("");
    fs.writeFileSync(fixture, script, "utf8");
    try {
      const created = createExternalMcpServer({
        id: "blackbox-stdio",
        displayName: "Blackbox stdio",
        transport: { kind: "stdio", command: "node", args: [fixture, marker] },
        disclaimerAccepted: true,
      });
      await connectExternalMcpServer(created.id);
      await discoverExternalMcpServer(created.id);
      updateExternalMcpAccess(created.id, { agentEnabled: true });
      registerAllExternalMcpCapabilities();
      const toolId = "mcp:blackbox-stdio:tool:health_check";
      const invocation = await executeHarnessInvocation({
        toolId,
        args: {},
        approvedInvocations: [{ toolId, inputHash: createInvocationInputHash({}) }],
      });
      assert.equal(invocation.status, "completed");
      assert.equal((invocation.result as { type?: string }).type, "external_mcp");
    } finally {
      try { fs.rmSync(marker, { force: true }); } catch { /* test cleanup */ }
      try { fs.rmSync(fixture, { force: true }); } catch { /* test cleanup */ }
    }
  });
});
