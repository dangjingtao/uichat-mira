import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  CodebaseExploreWrapper,
  ManagedCodeGraphProcessManager,
  createManagedCodeGraphWorkspaceHash,
  toAgentRetrievalEvidenceFromVerification,
  verifyCodebaseExploreResult,
} from "../index.js";
import { ManagedJsonRpcSession } from "../managed-jsonrpc-session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../../../../..");
const artifactRoot = path.join(workspaceRoot, ".test-artifact", "managed-codegraph");
const fixturePath = path.join(__dirname, "fixtures", "fake-codegraph-provider.mjs");

const tempDirs: string[] = [];
const activeManagers: ManagedCodeGraphProcessManager[] = [];

const makeTempDir = () => {
  fs.mkdirSync(artifactRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(artifactRoot, "case-"));
  tempDirs.push(tempDir);
  return tempDir;
};

const listRuntimeSourceFiles = (sourceDir: string): string[] => {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") {
        continue;
      }
      files.push(...listRuntimeSourceFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
};

const createManager = (
  overrides: Partial<ConstructorParameters<typeof ManagedCodeGraphProcessManager>[0]> = {},
) => {
  const tempDir = makeTempDir();
  const currentWorkspace = overrides.workspaceRoot ?? workspaceRoot;
  const manager = new ManagedCodeGraphProcessManager({
    command: process.execPath,
    startArgs: [fixturePath, "--mcp"],
    versionProbe: {
      args: [fixturePath, "--version"],
    },
    telemetryProbe: {
      args: [fixturePath, "--telemetry-status"],
    },
    env: {
      FAKE_PROVIDER_VERSION: "1.2.3",
      FAKE_TELEMETRY_STATUS: "disabled",
      FAKE_STRICT_INITIALIZED_MODE: "1",
      ...overrides.env,
    },
    workspaceRoot: currentWorkspace,
    allowedWorkspaceRoot: overrides.allowedWorkspaceRoot ?? currentWorkspace,
    logRoot: overrides.logRoot ?? path.join(tempDir, "logs"),
    indexRoot: overrides.indexRoot ?? path.join(tempDir, "index"),
    startTimeoutMs: overrides.startTimeoutMs ?? 1_500,
    healthTimeoutMs: overrides.healthTimeoutMs ?? 1_500,
    stopTimeoutMs: overrides.stopTimeoutMs ?? 500,
    repoPollutionGuard: overrides.repoPollutionGuard,
  });
  activeManagers.push(manager);
  return manager;
};

const createWrapper = (
  overrides: Partial<ConstructorParameters<typeof ManagedCodeGraphProcessManager>[0]> = {},
) => new CodebaseExploreWrapper(createManager(overrides));

const createWorkspaceFile = (relativePath: string, content: string) => {
  const workspaceDir = makeTempDir();
  const absolutePath = path.join(workspaceDir, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
  return {
    workspaceDir,
    relativePath: relativePath.replace(/\\/g, "/"),
    absolutePath,
  };
};

afterEach(async () => {
  for (const manager of activeManagers.splice(0)) {
    await manager.stop();
  }
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("ManagedCodeGraphProcessManager", () => {
  it("detects a missing provider as unavailable", async () => {
    const manager = new ManagedCodeGraphProcessManager({
      command: path.join(os.tmpdir(), "missing-codegraph-provider.exe"),
      startArgs: [],
      versionProbe: {
        args: ["--version"],
      },
      telemetryProbe: {
        args: ["--telemetry-status"],
      },
      workspaceRoot,
      allowedWorkspaceRoot: workspaceRoot,
      logRoot: path.join(makeTempDir(), "logs"),
      indexRoot: path.join(makeTempDir(), "index"),
    });

    const result = await manager.detect();

    expect(result.status).toBe("unavailable");
    expect(result.commandFound).toBe(false);
    expect(result.reasons).toContain("provider_missing");
  });

  it("blocks when telemetry cannot be verified off", async () => {
    const manager = createManager({
      env: {
        FAKE_TELEMETRY_STATUS: "enabled",
      },
    });

    const result = await manager.detect();

    expect(result.status).toBe("blocked");
    expect(result.telemetryStatus).toBe("not_verified");
  });

  it("starts successfully and reports ready", async () => {
    const manager = createManager();

    const started = await manager.start();
    const health = await manager.health();

    expect(started.status).toBe("ready");
    expect(health.status).toBe("ready");
    expect(health.processAlive).toBe(true);
    expect(health.providerVersion).toBe("1.2.3");
    expect(health.telemetryStatus).toBe("verified_off");
    expect(health.initializedNotificationSent).toBe(true);
    expect(health.workspaceHash).toBe(createManagedCodeGraphWorkspaceHash(workspaceRoot));

    await manager.stop();
  });

  it("reports telemetry status when blocked before launch", async () => {
    const manager = createManager({
      env: {
        FAKE_TELEMETRY_STATUS: "enabled",
      },
    });

    const started = await manager.start();

    expect(started.status).toBe("blocked");
    expect(started.telemetryStatus).toBe("not_verified");
  });

  it("reuses an existing process for duplicate start attempts", async () => {
    const tempDir = makeTempDir();
    const sharedOptions = {
      command: process.execPath,
      startArgs: [fixturePath, "--mcp"],
      versionProbe: {
        args: [fixturePath, "--version"],
      },
      telemetryProbe: {
        args: [fixturePath, "--telemetry-status"],
      },
      env: {
        FAKE_PROVIDER_VERSION: "1.2.3",
        FAKE_TELEMETRY_STATUS: "disabled",
        FAKE_STRICT_INITIALIZED_MODE: "1",
      },
      workspaceRoot,
      allowedWorkspaceRoot: workspaceRoot,
      logRoot: path.join(tempDir, "logs"),
      indexRoot: path.join(tempDir, "index"),
      startTimeoutMs: 1_500,
      healthTimeoutMs: 1_500,
      stopTimeoutMs: 500,
    } satisfies ConstructorParameters<typeof ManagedCodeGraphProcessManager>[0];

    const primary = new ManagedCodeGraphProcessManager(sharedOptions);
    const duplicate = new ManagedCodeGraphProcessManager(sharedOptions);

    const primaryStart = await primary.start();
    const duplicateStart = await duplicate.start();

    expect(primaryStart.status).toBe("ready");
    expect(duplicateStart.status).toBe("ready");
    expect(duplicateStart.startDisposition).toBe("reused_existing");

    await primary.stop();
  });

  it("marks health probe failures as degraded or failed without touching agent mainline", async () => {
    const manager = createManager({
      env: {
        FAKE_HEALTH_SEQUENCE: "ready,error",
      },
    });

    await manager.start();
    const health = await manager.health();

    expect(["degraded", "failed"]).toContain(health.status);

    await manager.stop();
  });

  it("stops successfully and records exit details", async () => {
    const manager = createManager();

    await manager.start();
    const stopped = await manager.stop();

    expect(stopped.status).toBe("stopped");
    expect(stopped.exitCode).toBe(0);
    expect(stopped.lastStatus).toBe("ready");
    expect(typeof stopped.durationMs).toBe("number");
  });

  it("degrades or fails after a crash", async () => {
    const manager = createManager({
      env: {
        FAKE_CRASH_AFTER_MS: "200",
      },
    });

    await manager.start();
    await new Promise((resolve) => setTimeout(resolve, 350));
    const health = await manager.health();

    expect(["degraded", "failed"]).toContain(health.status);
    expect(health.processAlive).toBe(false);
  });

  it("blocks workspace mismatches before launch", async () => {
    const manager = createManager({
      workspaceRoot: path.join(workspaceRoot, "server"),
      allowedWorkspaceRoot: workspaceRoot,
    });

    const started = await manager.start();

    expect(["blocked", "failed"]).toContain(started.status);
    expect(started.processAlive).toBe(false);
  });

  it("blocks before launch when external index root is unsupported for the real provider", async () => {
    const isolatedWorkspace = makeTempDir();
    const manager = createManager({
      workspaceRoot: isolatedWorkspace,
      allowedWorkspaceRoot: isolatedWorkspace,
      repoPollutionGuard: {
        status: "blocked",
        repoDataDirName: ".codegraph",
        blockedReason:
          "CodeGraph 1.3.0 does not support an external index root and would require a repo-root .codegraph directory.",
      },
    });

    const detected = await manager.detect();
    const started = await manager.start();

    expect(detected.status).toBe("blocked");
    expect(detected.reasons).toContain("repo_pollution_risk");
    expect(started.status).toBe("blocked");
    expect(started.lastError).toContain("external index root");
    expect(fs.existsSync(path.join(isolatedWorkspace, ".codegraph"))).toBe(false);
  });

  it("blocks and preserves an existing repo-root .codegraph directory", async () => {
    const isolatedWorkspace = makeTempDir();
    const repoCodeGraphDir = path.join(isolatedWorkspace, ".codegraph");
    fs.mkdirSync(repoCodeGraphDir, { recursive: true });
    fs.writeFileSync(path.join(repoCodeGraphDir, "sentinel.txt"), "user-owned", "utf8");

    const manager = createManager({
      workspaceRoot: isolatedWorkspace,
      allowedWorkspaceRoot: isolatedWorkspace,
      repoPollutionGuard: {
        status: "ready",
        repoDataDirName: ".codegraph",
        blockedReason: null,
      },
    });

    const detected = await manager.detect();
    const started = await manager.start();

    expect(detected.status).toBe("blocked");
    expect(detected.reasons).toContain("repo_root_codegraph_present");
    expect(started.status).toBe("blocked");
    expect(fs.readFileSync(path.join(repoCodeGraphDir, "sentinel.txt"), "utf8")).toBe("user-owned");
  });

  it("sends notifications/initialized immediately after initialize succeeds", async () => {
    const messageLogPath = path.join(makeTempDir(), "provider-messages.log");
    const manager = createManager({
      env: {
        FAKE_MESSAGE_LOG_PATH: messageLogPath,
      },
    });

    const started = await manager.start();
    const methodOrder = fs
      .readFileSync(messageLogPath, "utf8")
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { method: string | null })
      .map((frame) => frame.method);

    expect(started.status).toBe("ready");
    expect(started.initializedNotificationSent).toBe(true);
    expect(methodOrder).toContain("initialize");
    expect(methodOrder).toContain("notifications/initialized");
    expect(methodOrder).toContain("codegraph/health");
    expect(methodOrder.indexOf("notifications/initialized")).toBeGreaterThan(
      methodOrder.indexOf("initialize"),
    );
    expect(methodOrder.indexOf("codegraph/health")).toBeGreaterThan(
      methodOrder.indexOf("notifications/initialized"),
    );
  });

  it("never reports ready after repo pollution appears before health", async () => {
    const isolatedWorkspace = makeTempDir();
    const manager = createManager({
      workspaceRoot: isolatedWorkspace,
      allowedWorkspaceRoot: isolatedWorkspace,
      repoPollutionGuard: {
        status: "ready",
        repoDataDirName: ".codegraph",
        blockedReason: null,
      },
    });

    const started = await manager.start();
    expect(started.status).toBe("ready");

    const repoCodeGraphDir = path.join(isolatedWorkspace, ".codegraph");
    fs.mkdirSync(repoCodeGraphDir, { recursive: true });
    fs.writeFileSync(path.join(repoCodeGraphDir, "created-during-test.txt"), "pollution", "utf8");

    const health = await manager.health();

    expect(health.status).toBe("blocked");
    expect(health.lastError).toContain(".codegraph");
    expect(fs.readFileSync(path.join(repoCodeGraphDir, "created-during-test.txt"), "utf8")).toBe(
      "pollution",
    );
  });

  it("keeps the spike isolated from Planner exposure", () => {
    const sourceDir = path.resolve(__dirname, "..");
    const combinedSource = listRuntimeSourceFiles(sourceDir)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");

    expect(combinedSource).not.toMatch(/from\s+["'][^"']*(?:agent\/planner|\/planner(?:\/|\.))/i);
    expect(combinedSource).not.toMatch(/from\s+["'][^"']*agent-graph/i);
  });

  it("keeps the spike isolated from Evidence and read_file_slice integration", () => {
    const sourceDir = path.resolve(__dirname, "..");
    const combinedSource = listRuntimeSourceFiles(sourceDir)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");

    expect(combinedSource).not.toMatch(/appendRetrievalEvidence/);
    expect(combinedSource).not.toMatch(/appendToolExecutionEvidence/);
    expect(combinedSource).not.toMatch(/from\s+["'][^"']*read\//);
  });
});

describe("ManagedJsonRpcSession initialized notification contract", () => {
  it("fails codegraph/health before notifications/initialized is sent", async () => {
    const tempDir = makeTempDir();
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
        CODEGRAPH_LOG_ROOT: path.join(tempDir, "logs"),
        CODEGRAPH_INDEX_ROOT: path.join(tempDir, "index"),
      },
      stdoutLogPath: path.join(tempDir, "stdout.log"),
      stderrLogPath: path.join(tempDir, "stderr.log"),
    });

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

    await expect(
      session.request(
        "codegraph/health",
        {
          workspaceHash: createManagedCodeGraphWorkspaceHash(workspaceRoot),
          workspaceRoot,
          indexRoot: path.join(tempDir, "index"),
          logRoot: path.join(tempDir, "logs"),
        },
        1_500,
      ),
    ).rejects.toThrow(/notifications\/initialized required/i);

    session.notify("shutdown", {
      workspaceHash: createManagedCodeGraphWorkspaceHash(workspaceRoot),
    });
    await session.waitForExit(1_500);
  });

  it("allows codegraph/health after notifications/initialized is sent", async () => {
    const tempDir = makeTempDir();
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
        CODEGRAPH_LOG_ROOT: path.join(tempDir, "logs"),
        CODEGRAPH_INDEX_ROOT: path.join(tempDir, "index"),
      },
      stdoutLogPath: path.join(tempDir, "stdout.log"),
      stderrLogPath: path.join(tempDir, "stderr.log"),
    });

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
    session.notify("notifications/initialized");

    const health = await session.request<{
      providerVersion: string;
      telemetryStatus: string;
      workspaceHash: string;
      status: string;
    }>(
      "codegraph/health",
      {
        workspaceHash: createManagedCodeGraphWorkspaceHash(workspaceRoot),
        workspaceRoot,
        indexRoot: path.join(tempDir, "index"),
        logRoot: path.join(tempDir, "logs"),
      },
      1_500,
    );

    expect(health.providerVersion).toBe("1.2.3");
    expect(health.status).toBe("ready");

    session.notify("shutdown", {
      workspaceHash: createManagedCodeGraphWorkspaceHash(workspaceRoot),
    });
    await session.waitForExit(1_500);
  });
});

describe("CodebaseExploreWrapper", () => {
  it("infers agent-runtime scope from agent questions", async () => {
    const wrapper = createWrapper();
    const result = await wrapper.explore({
      query: "agent-runtime planner 如何决定 next action",
    });

    expect(result.scope).toEqual(["agent-runtime"]);
    expect(result.includePaths).toContain("server/src/agent/**");
  });

  it("infers harness-mcp scope from harness and MCP questions", async () => {
    const wrapper = createWrapper();
    const result = await wrapper.explore({
      query: "MCP harness 的 json-rpc runtime 在哪里处理",
    });

    expect(result.scope).toEqual(["harness-mcp"]);
    expect(result.includePaths).toEqual(
      expect.arrayContaining(["server/src/mcp/**", "server/src/harness/**"]),
    );
  });

  it("infers microapps scope from microapp questions", async () => {
    const wrapper = createWrapper();
    const result = await wrapper.explore({
      query: "microapps image generation studio 的入口在哪里",
    });

    expect(result.scope).toEqual(["microapps"]);
    expect(result.command).toBe("mixed");
    expect(result.includePaths).toContain("server/src/microapps/**");
  });

  it("infers docs scope from docs questions", async () => {
    const wrapper = createWrapper();
    const result = await wrapper.explore({
      query: "docs 里的 architecture readme 怎么定义 runtime 边界",
    });

    expect(result.scope).toEqual(["docs"]);
    expect(result.includePaths).toEqual(expect.arrayContaining(["docs/**", "README.md", "AGENTS.md"]));
  });

  it("falls back to workspace-general only when no narrower scope fits", async () => {
    const wrapper = createWrapper();
    const result = await wrapper.explore({
      query: "这个仓库里和 runtime config 相关的跨层入口有哪些",
    });

    expect(result.scope).toEqual(["workspace-general"]);
    expect(result.includePaths).toContain("runtime.config.cjs");
  });

  it("passes include and exclude paths through the wrapper request", async () => {
    const wrapper = createWrapper();
    const result = await wrapper.explore({
      query: "docs architecture",
      includePaths: ["docs/architecture/**"],
      excludePaths: ["docs/archive/**"],
    });

    expect(result.includePaths).toContain("docs/architecture/**");
    expect(result.excludePaths).toContain("docs/archive/**");
    expect(result.excludePaths).toContain(".test-artifact/**");
  });

  it("trims broad explore output and marks the result partial", async () => {
    const broadCandidates = Array.from({ length: 15 }, (_, index) => ({
      path: `docs/microapp/file-${index}.md`,
      startLine: index + 1,
      endLine: index + 30,
      kind: "text-hit",
      summary: `summary-${index}`,
      snippet: Array.from({ length: 30 }, () => "line").join("\n"),
      score: 0.8 - index * 0.01,
    }));
    const wrapper = createWrapper({
      env: {
        FAKE_EXPLORE_CANDIDATES: JSON.stringify(broadCandidates),
      },
    });

    const result = await wrapper.explore({
      query: "microapps architecture flow overview",
    });

    expect(result.status).toBe("partial");
    expect(result.truncated).toBe(true);
    expect(result.limitations).toEqual(
      expect.arrayContaining(["broad_query_noise_detected", "result_trimmed", "requires_follow_up_read"]),
    );
    expect(result.candidates.length).toBeLessThanOrEqual(12);
  });

  it("marks every candidate as verification required and pending", async () => {
    const wrapper = createWrapper();
    const result = await wrapper.explore({
      query: "docs architecture",
    });

    expect(result.candidates.length).toBeGreaterThan(0);
    for (const candidate of result.candidates) {
      expect(candidate.verification.required).toBe(true);
      expect(candidate.verification.status).toBe("pending");
    }
    expect(result.followUpReads.length).toBe(result.candidates.length);
    expect(result.trace.verificationRequired).toBe(true);
    expect(result.trace.verificationReadCount).toBe(result.followUpReads.length);
  });

  it("downgrades no-line-range candidates to low confidence and adds limitations", async () => {
    const wrapper = createWrapper({
      env: {
        FAKE_QUERY_CANDIDATES: JSON.stringify([
          {
            path: "server/src/mcp/router.ts",
            kind: "reference",
            summary: "router reference without line range",
            snippet: "registerRoute('mcp')",
            score: 0.95,
          },
        ]),
      },
    });

    const result = await wrapper.explore({
      query: "MCP router reference",
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.confidence).toBeLessThan(0.4);
    expect(result.candidates[0]?.limitations).toEqual(
      expect.arrayContaining(["missing_line_range", "requires_follow_up_read"]),
    );
  });

  it("returns degraded plus fallback signal when the provider query fails", async () => {
    const wrapper = createWrapper({
      env: {
        FAKE_QUERY_MODE: "error",
      },
    });

    const result = await wrapper.explore({
      query: "agent-runtime planner symbol",
    });

    expect(result.status).toBe("degraded");
    expect(result.degraded).toBe(true);
    expect(result.limitations).toContain("query_failed");
    expect(result.fallbackSignal).toMatchObject({
      required: true,
      reason: "query_failed",
    });
    expect(result.candidates).toHaveLength(0);
    expect(result.trace.status).toBe("failed");
    expect(result.trace.fallbackUsed).toBe(true);
    expect(result.trace.fallbackReason).toBe("query_failed");
  });

  it("emits complete ready-query trace fields", async () => {
    const wrapper = createWrapper();
    const result = await wrapper.explore({
      query: "agent-runtime planner next action",
    });

    expect(result.trace).toMatchObject({
      capabilityId: "codebase_explore",
      provider: "codegraph",
      runtimeShape: "managed_mcp",
      internalCommand: "query",
      status: "ok",
      selectedScope: ["agent-runtime"],
      verificationRequired: true,
    });
    expect(typeof result.trace.providerVersion === "string" || result.trace.providerVersion === null).toBe(true);
    expect(typeof result.trace.workspaceHash === "string" || result.trace.workspaceHash === null).toBe(true);
    expect(result.trace.includePaths).toContain("server/src/agent/**");
    expect(result.trace.excludePaths).toContain(".git/**");
    expect(result.trace.originalQuery).toBe("agent-runtime planner next action");
    expect(result.trace.normalizedQuery).toBe("agent-runtime planner next action");
    expect(result.trace.resultCount).toBe(result.candidates.length);
    expect(typeof result.trace.durationMs).toBe("number");
    expect(result.trace.telemetryStatus).toBe("verified_off");
  });

  it("includes limitations in partial truncated trace", async () => {
    const broadCandidates = Array.from({ length: 15 }, (_, index) => ({
      path: `docs/microapp/file-${index}.md`,
      startLine: index + 1,
      endLine: index + 30,
      kind: "text-hit",
      summary: `summary-${index}`,
      snippet: Array.from({ length: 30 }, () => "line").join("\n"),
      score: 0.8 - index * 0.01,
    }));
    const wrapper = createWrapper({
      env: {
        FAKE_EXPLORE_CANDIDATES: JSON.stringify(broadCandidates),
      },
    });

    const result = await wrapper.explore({
      query: "microapps architecture flow overview",
    });

    expect(result.trace.status).toBe("partial");
    expect(result.trace.truncated).toBe(true);
    expect(result.trace.limitations).toEqual(
      expect.arrayContaining(["broad_query_noise_detected", "result_trimmed"]),
    );
  });

  it("includes telemetryStatus in blocked trace", async () => {
    const wrapper = createWrapper({
      env: {
        FAKE_TELEMETRY_STATUS: "enabled",
      },
    });

    const result = await wrapper.explore({
      query: "agent-runtime planner symbol",
    });

    expect(result.trace.status).toBe("failed");
    expect(result.trace.telemetryStatus).toBe("not_verified");
    expect(result.trace.fallbackReason).toBe("provider_unavailable");
  });

  it("does not serialize raw output or duplicate source excerpts into trace", async () => {
    const wrapper = createWrapper({
      env: {
        FAKE_QUERY_CANDIDATES: JSON.stringify([
          {
            path: "server/src/agent/planner.ts",
            startLine: 1,
            endLine: 2,
            kind: "symbol-definition",
            summary: "planner entry point",
            snippet: "export function planner() {\n  return 'planner';\n}",
            score: 0.95,
          },
        ]),
      },
    });

    const result = await wrapper.explore({
      query: "agent-runtime planner symbol",
    });

    const traceJson = JSON.stringify(result.trace);
    expect(traceJson).not.toContain("return 'planner'");
    expect(traceJson).not.toContain("snippet");
    expect(traceJson).not.toContain("minimalExcerpt");
  });

  it("keeps wrapper code isolated from Planner exposure", () => {
    const sourceDir = path.resolve(__dirname, "..");
    const combinedSource = listRuntimeSourceFiles(sourceDir)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");

    expect(combinedSource).not.toMatch(/from\s+["'][^"']*(?:agent\/planner|\/planner(?:\/|\.))/i);
    expect(combinedSource).not.toMatch(/from\s+["'][^"']*agent-graph/i);
  });

  it("keeps wrapper code isolated from Evidence integration", () => {
    const sourceDir = path.resolve(__dirname, "..");
    const combinedSource = listRuntimeSourceFiles(sourceDir)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");

    expect(combinedSource).not.toMatch(/EvidenceItem/);
    expect(combinedSource).not.toMatch(/verification\.status\s*=\s*["']verified["']/);
    expect(combinedSource).not.toMatch(/from\s+["'][^"']*read\//);
  });
});

describe("CodeGraphVerificationBridge", () => {
  it("verifies a candidate with a valid path and line range", () => {
    const file = createWorkspaceFile(
      "server/src/agent/planner.ts",
      ["export function planner() {", "  return 'planner';", "}"].join("\n"),
    );
    const verification = verifyCodebaseExploreResult(
      {
        status: "ok",
        scope: ["agent-runtime"],
        query: "planner",
        engine: "codegraph",
        command: "query",
        includePaths: ["server/src/agent/**"],
        excludePaths: [".git/**"],
        candidates: [
          {
            path: file.relativePath,
            startLine: 1,
            endLine: 2,
            kind: "symbol-definition",
            summary: "planner return function",
            confidence: 0.9,
            snippet: null,
            source: {
              engine: "codegraph",
              command: "query",
            },
            verification: {
              required: true,
              status: "pending",
            },
            limitations: [],
          },
        ],
        followUpReads: [
          {
            candidateIndex: 0,
            path: file.relativePath,
            startLine: 1,
            endLine: 2,
            reason: "verify_candidate_excerpt",
            toolId: "read_file_slice",
          },
        ],
        truncated: false,
        degraded: false,
        followUpHints: [],
        limitations: [],
        fallbackSignal: null,
      },
      {
        workspaceRoot: file.workspaceDir,
      },
    );

    expect(verification.verified).toHaveLength(1);
    expect(verification.rejected).toHaveLength(0);
    expect(verification.unverifiable).toHaveLength(0);
    expect(verification.verified[0]?.minimalExcerpt).toContain("return 'planner'");
  });

  it("marks candidates without line ranges as unverifiable", () => {
    const file = createWorkspaceFile("docs/README.md", "hello\nworld");
    const verification = verifyCodebaseExploreResult(
      {
        status: "ok",
        scope: ["docs"],
        query: "docs",
        engine: "codegraph",
        command: "query",
        includePaths: ["docs/**"],
        excludePaths: [],
        candidates: [
          {
            path: file.relativePath,
            startLine: null,
            endLine: null,
            kind: "text-hit",
            summary: "docs hello world",
            confidence: 0.3,
            snippet: null,
            source: { engine: "codegraph", command: "query" },
            verification: { required: true, status: "pending" },
            limitations: ["missing_line_range", "requires_follow_up_read"],
          },
        ],
        followUpReads: [
          {
            candidateIndex: 0,
            path: file.relativePath,
            startLine: null,
            endLine: null,
            reason: "missing_line_range",
            toolId: "read_file_slice",
          },
        ],
        truncated: false,
        degraded: false,
        followUpHints: [],
        limitations: [],
        fallbackSignal: null,
      },
      { workspaceRoot: file.workspaceDir },
    );

    expect(verification.verified).toHaveLength(0);
    expect(verification.unverifiable).toHaveLength(1);
  });

  it("rejects candidates whose paths escape the workspace", () => {
    const file = createWorkspaceFile("docs/README.md", "hello\nworld");
    const verification = verifyCodebaseExploreResult(
      {
        status: "ok",
        scope: ["docs"],
        query: "docs",
        engine: "codegraph",
        command: "query",
        includePaths: ["docs/**"],
        excludePaths: [],
        candidates: [
          {
            path: "../secret.txt",
            startLine: 1,
            endLine: 1,
            kind: "text-hit",
            summary: "secret value",
            confidence: 0.8,
            snippet: null,
            source: { engine: "codegraph", command: "query" },
            verification: { required: true, status: "pending" },
            limitations: [],
          },
        ],
        followUpReads: [
          {
            candidateIndex: 0,
            path: "../secret.txt",
            startLine: 1,
            endLine: 1,
            reason: "verify_candidate_excerpt",
            toolId: "read_file_slice",
          },
        ],
        truncated: false,
        degraded: false,
        followUpHints: [],
        limitations: [],
        fallbackSignal: null,
      },
      { workspaceRoot: file.workspaceDir },
    );

    expect(verification.rejected).toHaveLength(1);
    expect(verification.rejected[0]?.mismatchNotes.join(" ")).toContain("outside the allowed workspace boundary");
  });

  it("rejects candidates when the original file is missing", () => {
    const workspaceDir = makeTempDir();
    const verification = verifyCodebaseExploreResult(
      {
        status: "ok",
        scope: ["agent-runtime"],
        query: "planner",
        engine: "codegraph",
        command: "query",
        includePaths: ["server/src/agent/**"],
        excludePaths: [],
        candidates: [
          {
            path: "server/src/agent/missing.ts",
            startLine: 1,
            endLine: 3,
            kind: "symbol-definition",
            summary: "missing planner file",
            confidence: 0.7,
            snippet: null,
            source: { engine: "codegraph", command: "query" },
            verification: { required: true, status: "pending" },
            limitations: [],
          },
        ],
        followUpReads: [
          {
            candidateIndex: 0,
            path: "server/src/agent/missing.ts",
            startLine: 1,
            endLine: 3,
            reason: "verify_candidate_excerpt",
            toolId: "read_file_slice",
          },
        ],
        truncated: false,
        degraded: false,
        followUpHints: [],
        limitations: [],
        fallbackSignal: null,
      },
      { workspaceRoot: workspaceDir },
    );

    expect(verification.rejected).toHaveLength(1);
    expect(verification.rejected[0]?.mismatchNotes.join(" ")).toContain("missing");
  });

  it("records mismatches when provider summary does not match the original excerpt", () => {
    const file = createWorkspaceFile(
      "server/src/mcp/router.ts",
      ["export const route = () => {", "  return 'mcp';", "}"].join("\n"),
    );
    const verification = verifyCodebaseExploreResult(
      {
        status: "ok",
        scope: ["harness-mcp"],
        query: "router",
        engine: "codegraph",
        command: "query",
        includePaths: ["server/src/mcp/**"],
        excludePaths: [],
        candidates: [
          {
            path: file.relativePath,
            startLine: 1,
            endLine: 2,
            kind: "reference",
            summary: "totally unrelated websocket manager",
            confidence: 0.9,
            snippet: null,
            source: { engine: "codegraph", command: "query" },
            verification: { required: true, status: "pending" },
            limitations: [],
          },
        ],
        followUpReads: [
          {
            candidateIndex: 0,
            path: file.relativePath,
            startLine: 1,
            endLine: 2,
            reason: "provider_mismatch_check",
            toolId: "read_file_slice",
          },
        ],
        truncated: false,
        degraded: false,
        followUpHints: [],
        limitations: [],
        fallbackSignal: null,
      },
      { workspaceRoot: file.workspaceDir },
    );

    expect(verification.rejected).toHaveLength(1);
    expect(verification.rejected[0]?.mismatchNotes[0]).toContain("provider_summary_mismatch");
  });

  it("only lets the verified subset enter the verified evidence input", () => {
    const file = createWorkspaceFile(
      "docs/guide.md",
      ["guide start", "verified content", "tail"].join("\n"),
    );
    const verification = verifyCodebaseExploreResult(
      {
        status: "partial",
        scope: ["docs"],
        query: "guide",
        engine: "codegraph",
        command: "mixed",
        includePaths: ["docs/**"],
        excludePaths: [],
        candidates: [
          {
            path: file.relativePath,
            startLine: 1,
            endLine: 2,
            kind: "text-hit",
            summary: "guide verified content",
            confidence: 0.8,
            snippet: null,
            source: { engine: "codegraph", command: "mixed" },
            verification: { required: true, status: "pending" },
            limitations: [],
          },
          {
            path: "../outside.md",
            startLine: 1,
            endLine: 1,
            kind: "text-hit",
            summary: "outside content",
            confidence: 0.4,
            snippet: null,
            source: { engine: "codegraph", command: "mixed" },
            verification: { required: true, status: "pending" },
            limitations: [],
          },
          {
            path: file.relativePath,
            startLine: null,
            endLine: null,
            kind: "text-hit",
            summary: "no lines",
            confidence: 0.2,
            snippet: null,
            source: { engine: "codegraph", command: "mixed" },
            verification: { required: true, status: "pending" },
            limitations: ["missing_line_range"],
          },
        ],
        followUpReads: [
          {
            candidateIndex: 0,
            path: file.relativePath,
            startLine: 1,
            endLine: 2,
            reason: "verify_candidate_excerpt",
            toolId: "read_file_slice",
          },
          {
            candidateIndex: 1,
            path: "../outside.md",
            startLine: 1,
            endLine: 1,
            reason: "verify_candidate_excerpt",
            toolId: "read_file_slice",
          },
          {
            candidateIndex: 2,
            path: file.relativePath,
            startLine: null,
            endLine: null,
            reason: "missing_line_range",
            toolId: "read_file_slice",
          },
        ],
        truncated: false,
        degraded: false,
        followUpHints: [],
        limitations: [],
        fallbackSignal: null,
      },
      { workspaceRoot: file.workspaceDir },
    );

    expect(verification.verified).toHaveLength(1);
    expect(verification.rejected).toHaveLength(1);
    expect(verification.unverifiable).toHaveLength(1);
    expect(verification.verifiedEvidenceInput.chunks).toHaveLength(1);

    const retrieval = toAgentRetrievalEvidenceFromVerification(verification);
    expect(retrieval.chunkCount).toBe(1);
    expect(retrieval.chunks).toHaveLength(1);
    expect(verification.trace.verificationReadCount).toBe(3);
    expect(verification.trace.status).toBe("partial");
  });

  it("keeps rejected candidates visible instead of silently dropping them", () => {
    const workspaceDir = makeTempDir();
    const verification = verifyCodebaseExploreResult(
      {
        status: "ok",
        scope: ["docs"],
        query: "docs",
        engine: "codegraph",
        command: "query",
        includePaths: ["docs/**"],
        excludePaths: [],
        candidates: [
          {
            path: "missing.md",
            startLine: 1,
            endLine: 2,
            kind: "text-hit",
            summary: "missing docs",
            confidence: 0.5,
            snippet: null,
            source: { engine: "codegraph", command: "query" },
            verification: { required: true, status: "pending" },
            limitations: [],
          },
        ],
        followUpReads: [
          {
            candidateIndex: 0,
            path: "missing.md",
            startLine: 1,
            endLine: 2,
            reason: "verify_candidate_excerpt",
            toolId: "read_file_slice",
          },
        ],
        truncated: false,
        degraded: false,
        followUpHints: [],
        limitations: [],
        fallbackSignal: null,
      },
      { workspaceRoot: workspaceDir },
    );

    expect(verification.rejected).toHaveLength(1);
    expect(verification.verifiedEvidenceInput.chunks).toHaveLength(0);
  });

  it("emits verification trace without duplicating source excerpts", () => {
    const file = createWorkspaceFile(
      "server/src/agent/planner.ts",
      ["export function planner() {", "  return 'planner';", "}"].join("\n"),
    );
    const verification = verifyCodebaseExploreResult(
      {
        status: "ok",
        scope: ["agent-runtime"],
        query: "planner",
        engine: "codegraph",
        command: "query",
        includePaths: ["server/src/agent/**"],
        excludePaths: [],
        candidates: [
          {
            path: file.relativePath,
            startLine: 1,
            endLine: 2,
            kind: "symbol-definition",
            summary: "planner return function",
            confidence: 0.9,
            snippet: "export function planner() {\n  return 'planner';\n}",
            source: {
              engine: "codegraph",
              command: "query",
            },
            verification: {
              required: true,
              status: "pending",
            },
            limitations: [],
          },
        ],
        followUpReads: [
          {
            candidateIndex: 0,
            path: file.relativePath,
            startLine: 1,
            endLine: 2,
            reason: "verify_candidate_excerpt",
            toolId: "read_file_slice",
          },
        ],
        truncated: false,
        degraded: false,
        followUpHints: [],
        limitations: [],
        fallbackSignal: null,
        trace: {
          capabilityId: "codebase_explore",
          provider: "codegraph",
          providerVersion: "1.2.3",
          runtimeShape: "managed_mcp",
          workspaceHash: "hash",
          selectedScope: ["agent-runtime"],
          includePaths: ["server/src/agent/**"],
          excludePaths: [],
          originalQuery: "planner",
          normalizedQuery: "planner",
          internalCommand: "query",
          resultCount: 1,
          truncated: false,
          limitations: [],
          fallbackUsed: false,
          fallbackReason: null,
          verificationRequired: true,
          verificationReadCount: 1,
          status: "ok",
          durationMs: 12,
          indexStatus: "ready",
          telemetryStatus: "verified_off",
        },
      },
      { workspaceRoot: file.workspaceDir },
    );

    const traceJson = JSON.stringify(verification.trace);
    expect(traceJson).not.toContain("return 'planner'");
    expect(traceJson).not.toContain("minimalExcerpt");
    expect(verification.trace.verificationReadCount).toBe(1);
    expect(verification.trace.verificationRequired).toBe(true);
  });

  it("keeps verification bridge code isolated from Planner exposure", () => {
    const sourceDir = path.resolve(__dirname, "..");
    const combinedSource = listRuntimeSourceFiles(sourceDir)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");

    expect(combinedSource).not.toMatch(/from\s+["'][^"']*(?:agent\/planner|\/planner(?:\/|\.))/i);
  });

  it("keeps verification bridge code isolated from Generate behavior changes", () => {
    const sourceDir = path.resolve(__dirname, "..");
    const combinedSource = listRuntimeSourceFiles(sourceDir)
      .map((filePath) => fs.readFileSync(filePath, "utf8"))
      .join("\n");

    expect(combinedSource).not.toMatch(/from\s+["'][^"']*generate/i);
    expect(combinedSource).not.toMatch(/answerClaimsUnverifiedObservation/);
  });
});
