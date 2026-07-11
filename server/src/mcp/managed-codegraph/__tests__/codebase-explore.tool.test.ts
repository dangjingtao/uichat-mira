import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "vitest";

import { createHarnessEnvironmentSnapshot } from "@/harness/environment.js";
import {
  createCodeGraphStudioService,
  setActiveCodeGraphStudioService,
} from "@/microapps/codegraph/index.js";
import { codebaseExploreTool } from "../codebase-explore.tool.js";

const fixturePath = path.join(__dirname, "fixtures", "fake-codegraph-provider.mjs");
const storageRoot = path.join(os.tmpdir(), "codebase-explore-tool-storage");

const originalEnv = {
  UI_CHAT_CODEGRAPH_APP_DATA_ROOT: process.env.UI_CHAT_CODEGRAPH_APP_DATA_ROOT,
  UI_CHAT_LOG_DIR: process.env.UI_CHAT_LOG_DIR,
  UI_CHAT_DATABASE_DIR: process.env.UI_CHAT_DATABASE_DIR,
  UI_CHAT_CODEGRAPH_COMMAND: process.env.UI_CHAT_CODEGRAPH_COMMAND,
  UI_CHAT_CODEGRAPH_START_ARGS: process.env.UI_CHAT_CODEGRAPH_START_ARGS,
  UI_CHAT_CODEGRAPH_VERSION_ARGS: process.env.UI_CHAT_CODEGRAPH_VERSION_ARGS,
  UI_CHAT_CODEGRAPH_TELEMETRY_ARGS: process.env.UI_CHAT_CODEGRAPH_TELEMETRY_ARGS,
  FAKE_PROVIDER_VERSION: process.env.FAKE_PROVIDER_VERSION,
  FAKE_TELEMETRY_STATUS: process.env.FAKE_TELEMETRY_STATUS,
  FAKE_QUERY_MODE: process.env.FAKE_QUERY_MODE,
  FAKE_QUERY_CANDIDATES: process.env.FAKE_QUERY_CANDIDATES,
  FAKE_EXPLORE_CANDIDATES: process.env.FAKE_EXPLORE_CANDIDATES,
};

const applyToolEnv = () => {
  process.env.UI_CHAT_CODEGRAPH_APP_DATA_ROOT = path.join(
    os.tmpdir(),
    "codebase-explore-tool-appdata",
  );
  process.env.UI_CHAT_CODEGRAPH_COMMAND = process.execPath;
  process.env.UI_CHAT_CODEGRAPH_START_ARGS = JSON.stringify([fixturePath, "--mcp"]);
  process.env.UI_CHAT_CODEGRAPH_VERSION_ARGS = JSON.stringify([fixturePath, "--version"]);
  process.env.UI_CHAT_CODEGRAPH_TELEMETRY_ARGS = JSON.stringify([
    fixturePath,
    "--telemetry-status",
  ]);
  process.env.FAKE_PROVIDER_VERSION = "9.9.9";
  process.env.FAKE_TELEMETRY_STATUS = "disabled";
  delete process.env.FAKE_QUERY_MODE;
  delete process.env.FAKE_QUERY_CANDIDATES;
  delete process.env.FAKE_EXPLORE_CANDIDATES;
};

const configureStudioService = async (
  workspaceRoot: string,
  overrides?: {
    agentCapabilityEnabled?: boolean;
    appDataRoot?: string;
    command?: string;
  },
) => {
  fs.rmSync(storageRoot, { recursive: true, force: true });
  fs.mkdirSync(storageRoot, { recursive: true });
  const service = createCodeGraphStudioService({
    workspaceRoot,
    storageRoot,
  });
  setActiveCodeGraphStudioService(service);
  service.saveConfig({
    microAppEnabled: true,
    agentCapabilityEnabled: overrides?.agentCapabilityEnabled ?? true,
    command: overrides?.command ?? process.env.UI_CHAT_CODEGRAPH_COMMAND ?? process.execPath,
    startArgs: [fixturePath, "--mcp"],
    versionProbeArgs: [fixturePath, "--version"],
    telemetryProbeArgs: [fixturePath, "--telemetry-status"],
    appDataRoot:
      overrides?.appDataRoot ??
      process.env.UI_CHAT_CODEGRAPH_APP_DATA_ROOT ??
      path.join(os.tmpdir(), "codebase-explore-tool-appdata"),
  });
  await service.start();
  await service.health();
  return service;
};

afterEach(() => {
  setActiveCodeGraphStudioService(null);
  fs.rmSync(storageRoot, { recursive: true, force: true });
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test("codebaseExploreTool returns controlled exposure traces and verified evidence", async () => {
  applyToolEnv();

  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "codebase-explore-tool-"),
  );
  fs.mkdirSync(path.join(workspaceRoot, "server", "src", "agent"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(workspaceRoot, "server", "src", "agent", "planner.ts"),
    "export function planner() {\n  return 'planner';\n}\n",
    "utf8",
  );
  process.env.FAKE_QUERY_CANDIDATES = JSON.stringify([
    {
      path: "server/src/agent/planner.ts",
      startLine: 1,
      endLine: 2,
      kind: "symbol-definition",
      summary: "planner function returns planner",
      snippet: "export function planner() {\n  return 'planner';\n}",
      score: 0.94,
    },
  ]);
  await configureStudioService(workspaceRoot);

  const artifacts: unknown[] = [];
  const result = await codebaseExploreTool.execute({
    invocationId: "invocation-1",
    args: { query: "planner function" },
    pushEvent: () => {},
    addArtifact: (artifact) => {
      artifacts.push(artifact);
      return { id: "artifact-1", ...artifact };
    },
    trace: {
      startSpan: () => ({
        spanId: "span-1",
        end: () => {},
      }),
    },
    signal: new AbortController().signal,
    environment: createHarnessEnvironmentSnapshot({
      workspace: {
        rootPath: workspaceRoot,
        source: "selected",
      },
    }),
  });

  const payload = result.result as Record<string, unknown>;
  const retrieval = payload.verifiedEvidenceInput as Record<string, unknown>;
  const trace = payload.trace as Record<string, unknown>;
  const exploreTrace = trace.explore as Record<string, unknown>;
  const verificationTrace = trace.verification as Record<string, unknown>;

  assert.equal(payload.capabilityId, "codebase_explore");
  assert.equal(payload.plannerExposure, "controlled_tool_only");
  assert.equal(retrieval.chunkCount, 1);
  assert.equal(
    ((retrieval.summary as Record<string, unknown>).keyFindings as string[]).some(
      (fact) => fact === "verifiedChunkCount=1",
    ),
    true,
  );
  assert.equal(exploreTrace.exposureMode, "controlled_tool_only");
  assert.equal(exploreTrace.provider, "codegraph");
  assert.equal(exploreTrace.providerVersion, "9.9.9");
  assert.equal(verificationTrace.exposureMode, "controlled_tool_only");
  assert.equal(artifacts.length, 1);
});

test("codebaseExploreTool keeps provider unavailable runs degraded and does not fabricate verified evidence", async () => {
  applyToolEnv();
  process.env.FAKE_TELEMETRY_STATUS = "not_verified";

  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "codebase-explore-tool-blocked-"),
  );
  await configureStudioService(workspaceRoot);

  const result = await codebaseExploreTool.execute({
    invocationId: "invocation-2",
    args: { query: "planner function" },
    pushEvent: () => {},
    addArtifact: (artifact) => ({ id: "artifact-2", ...artifact }),
    trace: {
      startSpan: () => ({
        spanId: "span-2",
        end: () => {},
      }),
    },
    signal: new AbortController().signal,
    environment: createHarnessEnvironmentSnapshot({
      workspace: {
        rootPath: workspaceRoot,
        source: "selected",
      },
    }),
  });

  const payload = result.result as Record<string, unknown>;
  const exploreResult = payload.exploreResult as Record<string, unknown>;
  const retrieval = payload.verifiedEvidenceInput as Record<string, unknown>;
  const trace = payload.trace as Record<string, unknown>;
  const exploreTrace = trace.explore as Record<string, unknown>;

  assert.equal(exploreResult.status, "degraded");
  assert.equal(retrieval.chunkCount, 0);
  assert.equal(exploreTrace.fallbackUsed, true);
  assert.equal(exploreTrace.fallbackReason, "provider_unavailable");
  assert.equal(exploreTrace.exposureMode, "controlled_tool_only");
});

test("codebaseExploreTool reports blocked provider status when app-data root cannot be resolved", async () => {
  applyToolEnv();
  delete process.env.UI_CHAT_CODEGRAPH_APP_DATA_ROOT;
  delete process.env.UI_CHAT_LOG_DIR;
  delete process.env.UI_CHAT_DATABASE_DIR;

  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "codebase-explore-tool-no-appdata-"),
  );
  const service = createCodeGraphStudioService({
    workspaceRoot,
    storageRoot,
  });
  setActiveCodeGraphStudioService(service);

  const result = await codebaseExploreTool.execute({
    invocationId: "invocation-3",
    args: { query: "planner function" },
    pushEvent: () => {},
    addArtifact: (artifact) => ({ id: "artifact-3", ...artifact }),
    trace: {
      startSpan: () => ({
        spanId: "span-3",
        end: () => {},
      }),
    },
    signal: new AbortController().signal,
    environment: createHarnessEnvironmentSnapshot({
      workspace: {
        rootPath: workspaceRoot,
        source: "selected",
      },
    }),
  });

  const payload = result.result as Record<string, unknown>;
  const exploreTrace = (payload.trace as Record<string, unknown>)
    .explore as Record<string, unknown>;

  assert.equal((payload.exploreResult as Record<string, unknown>).status, "degraded");
  assert.equal(exploreTrace.indexStatus, "blocked");
  assert.equal(exploreTrace.fallbackReason, "provider_unavailable");
  assert.equal(exploreTrace.workspaceHash, null);
});

test("codebaseExploreTool keeps repo pollution risk blocked instead of treating it as empty results", async () => {
  applyToolEnv();
  process.env.UI_CHAT_CODEGRAPH_COMMAND = "codegraph";

  const workspaceRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "codebase-explore-tool-pollution-risk-"),
  );
  const blockedAppDataRoot = path.join(os.tmpdir(), "codebase-explore-tool-blocked-appdata");
  fs.mkdirSync(blockedAppDataRoot, { recursive: true });
  const service = createCodeGraphStudioService({
    workspaceRoot,
    storageRoot,
  });
  setActiveCodeGraphStudioService(service);
  service.saveConfig({
    microAppEnabled: true,
    agentCapabilityEnabled: true,
    command: "codegraph",
    startArgs: ["serve", "--mcp"],
    versionProbeArgs: ["--version"],
    telemetryProbeArgs: ["telemetry", "status"],
    appDataRoot: blockedAppDataRoot,
  });

  const result = await codebaseExploreTool.execute({
    invocationId: "invocation-4",
    args: { query: "planner function" },
    pushEvent: () => {},
    addArtifact: (artifact) => ({ id: "artifact-4", ...artifact }),
    trace: {
      startSpan: () => ({
        spanId: "span-4",
        end: () => {},
      }),
    },
    signal: new AbortController().signal,
    environment: createHarnessEnvironmentSnapshot({
      workspace: {
        rootPath: workspaceRoot,
        source: "selected",
      },
    }),
  });

  const payload = result.result as Record<string, unknown>;
  const exploreResult = payload.exploreResult as Record<string, unknown>;
  const exploreTrace = (payload.trace as Record<string, unknown>)
    .explore as Record<string, unknown>;
  const retrieval = payload.verifiedEvidenceInput as Record<string, unknown>;
  const hints = exploreResult.followUpHints as string[];

  assert.equal(exploreResult.status, "degraded");
  assert.equal(retrieval.chunkCount, 0);
  assert.equal(exploreTrace.fallbackReason, "provider_unavailable");
  assert.equal(hints.some((hint) => hint.includes("repo-root .codegraph")), true);
});
