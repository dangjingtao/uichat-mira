import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", () => ({
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

    stdin.on("data", (chunk: Buffer) => {
      const message = chunk.toString("utf8");
      if (message.includes('"method":"initialize"')) {
        const idMatch = message.match(/"id":"([^"]+)"/);
        const requestId = idMatch?.[1] ?? "1";
        const response = {
          jsonrpc: "2.0",
          id: requestId,
          result: {
            protocolVersion: "2025-06-18",
            serverInfo: { name: "slideshot", version: "4.4.0" },
            capabilities: { tools: {} },
          },
        };
        stdout.write(`${JSON.stringify(response)}\n`);
      }
    });

    return processMock;
  }),
  spawnSync: vi.fn(() => ({ status: 0 })),
}));

describe("stdio session", () => {
  it("writes MCP frames and resolves initialize replies", async () => {
    const { StdioMcpSession } = await import("./stdio-session.js");
    const session = new StdioMcpSession({
      command: "slideshot-mcp",
      args: [],
    });

    const result = await session.request(
      "initialize",
      {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "probe", version: "0.0.0" },
      },
      1000,
    );

    expect(result).toEqual({
      protocolVersion: "2025-06-18",
      serverInfo: { name: "slideshot", version: "4.4.0" },
      capabilities: { tools: {} },
    });
  });
});
