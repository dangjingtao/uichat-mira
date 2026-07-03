import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearExternalMcpServers,
  connectExternalMcpServer,
  createExternalMcpServer,
  discoverExternalMcpServer,
  getExternalMcpServerConfig,
  updateExternalMcpServerConfig,
  initializeExternalMcpDatabase,
} from "./external.js";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: vi.fn(() => {
      const stdout = new PassThrough();
      const stderr = new PassThrough();
      const stdin = new PassThrough();
      const handlers = {
        error: [] as Array<(error: Error) => void>,
        exit: [] as Array<(code: number | null, signal: NodeJS.Signals | null) => void>,
      };
      const processMock = {
        stdout,
        stderr,
        stdin,
        killed: false,
        kill: vi.fn(() => true),
        on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
          if (event === "error") {
            handlers.error.push(callback as (error: Error) => void);
          }
          if (event === "exit") {
            handlers.exit.push(callback as (code: number | null, signal: NodeJS.Signals | null) => void);
          }
          return processMock;
        }),
      };

      queueMicrotask(() => {
        const error = new Error("spawn npx ENOENT");
        for (const handler of handlers.error) {
          handler(error);
        }
      });

      return processMock;
    }),
  };
});

describe("external MCP connect", () => {
  const tempDb = path.join(os.tmpdir(), `rag-demo-mcp-connect-${process.pid}-${Date.now()}.sqlite`);

  beforeEach(() => {
    process.env.DATABASE_URL = `file:${tempDb}`;
    initializeExternalMcpDatabase();
    clearExternalMcpServers();
  });

  afterEach(() => {
    clearExternalMcpServers();
    delete process.env.DATABASE_URL;
  });

  it("surfaces a friendly launcher hint when stdio command is missing", async () => {
    const server = createExternalMcpServer({
      displayName: "Slideshot",
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "slideshot-mcp"],
      },
      disclaimerAccepted: true,
    });

    await expect(connectExternalMcpServer(server.id)).rejects.toThrow(
      /找不到 npx/,
    );
  });

  it("reuses an installed external MCP server id instead of failing on duplicate install", async () => {
    const first = createExternalMcpServer({
      id: "ac.tandem.docs-mcp",
      displayName: "Tandem Docs",
      registryUrl: "https://registry.modelcontextprotocol.io/v0.1/servers",
      transport: {
        kind: "streamable-http",
        url: "https://tandem.ac/mcp",
      },
      disclaimerAccepted: true,
    });

    const second = createExternalMcpServer({
      id: "ac.tandem.docs-mcp",
      displayName: "Tandem Docs",
      registryUrl: "https://registry.modelcontextprotocol.io/v0.1/servers",
      transport: {
        kind: "streamable-http",
        url: "https://tandem.ac/mcp",
      },
      disclaimerAccepted: true,
    });

    expect(first.id).toBe("ac.tandem.docs-mcp");
    expect(second.id).toBe("ac.tandem.docs-mcp");
    expect(second.status).toBe("configured");
  });

  it("resets prior runtime state when reinstalling the same server id", async () => {
    vi.doUnmock("node:child_process");
    vi.resetModules();

    vi.doMock("node:child_process", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:child_process")>();
      return {
        ...actual,
        spawnSync: vi.fn(() => ({ status: 0 })),
        spawn: vi.fn(() => {
          const stdout = new PassThrough();
          const stderr = new PassThrough();
          const stdin = new PassThrough();
          const handlers = {
            error: [] as Array<(error: Error) => void>,
            exit: [] as Array<(code: number | null, signal: NodeJS.Signals | null) => void>,
          };

          const processMock = {
            stdout,
            stderr,
            stdin,
            killed: false,
            kill: vi.fn(() => {
              processMock.killed = true;
              return true;
            }),
            on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
              if (event === "error") {
                handlers.error.push(callback as (error: Error) => void);
              }
              if (event === "exit") {
                handlers.exit.push(
                  callback as (code: number | null, signal: NodeJS.Signals | null) => void,
                );
              }
              return processMock;
            }),
          };

          stdin.on("data", (chunk: Buffer) => {
            const message = chunk.toString("utf8").trim();
            if (!message) {
              return;
            }
            const parsed = JSON.parse(message) as { id?: string; method?: string };
            if (parsed.method === "initialize") {
              stdout.write(
                `${JSON.stringify({
                  jsonrpc: "2.0",
                  id: parsed.id,
                  result: {
                    protocolVersion: "2025-06-18",
                    serverInfo: { name: "slideshot", version: "4.4.0" },
                    capabilities: { tools: {} },
                  },
                })}\n`,
              );
              return;
            }

            if (parsed.method === "tools/list") {
              stdout.write(
                `${JSON.stringify({
                  jsonrpc: "2.0",
                  id: parsed.id,
                  result: {
                    tools: [
                      {
                        name: "health_check",
                        title: "Health Check",
                        description: "Checks the server",
                        inputSchema: { type: "object", properties: {} },
                      },
                    ],
                  },
                })}\n`,
              );
            }
          });

          return processMock;
        }),
      };
    });

    const external = await import("./external.js");
    const first = external.createExternalMcpServer({
      id: "slideshot",
      displayName: "Slideshot",
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "slideshot-mcp"],
      },
      disclaimerAccepted: true,
    });

    await external.connectExternalMcpServer(first.id);
    const discovered = await external.discoverExternalMcpServer(first.id);
    expect(discovered.status).toBe("connected");
    expect(discovered.discoveredTools).toHaveLength(1);

    const reinstalled = external.createExternalMcpServer({
      id: "slideshot",
      displayName: "Slideshot",
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "slideshot-mcp"],
      },
      disclaimerAccepted: true,
    });

    expect(reinstalled.status).toBe("configured");
    expect(reinstalled.sessionId).toBeUndefined();
    expect(reinstalled.protocolVersion).toBeUndefined();
    expect(reinstalled.discoveredTools).toHaveLength(0);
    expect(reinstalled.remoteServerInfo).toBeUndefined();
  });

  it("stores cwd and envJson in stdio config updates", async () => {
    const server = createExternalMcpServer({
      id: "stdio-config",
      displayName: "Stdio Config",
      transport: {
        kind: "stdio",
        command: "npx",
        args: ["-y", "slideshot-mcp"],
      },
      disclaimerAccepted: true,
    });

    const updated = updateExternalMcpServerConfig(server.id, {
      command: "npx",
      argsText: '["-y","slideshot-mcp"]',
      cwd: "D:\\workspace\\rag-demo",
      envJson: '{\n  "HTTP_PROXY": "http://127.0.0.1:7890"\n}',
      authType: "none",
      timeoutMs: 45000,
      customHeadersJson: "",
      bearerToken: null,
    });

    expect(updated.cwd).toBe("D:\\workspace\\rag-demo");
    expect(updated.envJson).toBe('{\n  "HTTP_PROXY": "http://127.0.0.1:7890"\n}');

    const current = getExternalMcpServerConfig(server.id);
    expect(current.cwd).toBe("D:\\workspace\\rag-demo");
    expect(current.envJson).toBe('{\n  "HTTP_PROXY": "http://127.0.0.1:7890"\n}');
  });
});
