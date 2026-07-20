import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { createManagedCodeGraphWorkspaceHash } from "../index.js";
import { ManagedJsonRpcSession } from "../managed-jsonrpc-session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "fake-codegraph-provider.mjs");
const tempDirs: string[] = [];

const makeTempDir = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mira-fake-codegraph-"));
  tempDirs.push(root);
  return root;
};

const createSession = (env: Record<string, string> = {}) => {
  const workspaceRoot = makeTempDir();
  const runtimeRoot = makeTempDir();
  const session = new ManagedJsonRpcSession({
    command: process.execPath,
    args: [fixturePath, "--mcp"],
    cwd: workspaceRoot,
    env: {
      FAKE_PROVIDER_VERSION: "1.2.3",
      FAKE_TELEMETRY_STATUS: "disabled",
      FAKE_STRICT_INITIALIZED_MODE: "1",
      CODEGRAPH_WORKSPACE_ROOT: workspaceRoot,
      CODEGRAPH_WORKSPACE_HASH: createManagedCodeGraphWorkspaceHash(workspaceRoot),
      CODEGRAPH_LOG_ROOT: path.join(runtimeRoot, "logs"),
      CODEGRAPH_INDEX_ROOT: path.join(runtimeRoot, "index"),
      ...env,
    },
    stdoutLogPath: path.join(runtimeRoot, "stdout.log"),
    stderrLogPath: path.join(runtimeRoot, "stderr.log"),
  });

  return {
    session,
    workspaceRoot,
  };
};

const initializeSession = async (session: ManagedJsonRpcSession) => {
  await session.request(
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "uichat-mira-test",
        version: "0.0.0",
      },
    },
    1_500,
  );
  session.notify("notifications/initialized", {});
};

afterEach(() => {
  for (const root of tempDirs.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("fake CodeGraph provider candidate contract", () => {
  it("returns no retrieval candidates unless a test explicitly injects them", async () => {
    const { session, workspaceRoot } = createSession();
    await initializeSession(session);

    for (const method of ["codegraph/query", "codegraph/explore", "codegraph/affected"] as const) {
      const result = await session.request<{ candidates?: unknown[] }>(
        method,
        {
          query: "anything",
          includePaths: [],
          excludePaths: [],
        },
        1_500,
      );
      expect(result.candidates).toEqual([]);
    }

    session.notify("shutdown", {
      workspaceHash: createManagedCodeGraphWorkspaceHash(workspaceRoot),
    });
    await session.waitForExit(1_500);
  });

  it("returns only explicitly injected candidates", async () => {
    const injected = [
      {
        path: "src/example.ts",
        startLine: 1,
        endLine: 2,
        kind: "reference",
        summary: "explicit fixture candidate",
        snippet: "export const example = true;",
        score: 0.9,
      },
    ];
    const { session, workspaceRoot } = createSession({
      FAKE_QUERY_CANDIDATES: JSON.stringify(injected),
    });
    await initializeSession(session);

    const result = await session.request<{ candidates?: unknown[] }>(
      "codegraph/query",
      {
        query: "example",
        includePaths: [],
        excludePaths: [],
      },
      1_500,
    );

    expect(result.candidates).toEqual(injected);

    session.notify("shutdown", {
      workspaceHash: createManagedCodeGraphWorkspaceHash(workspaceRoot),
    });
    await session.waitForExit(1_500);
  });
});