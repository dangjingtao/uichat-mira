import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createCodeGraphStudioService,
  setActiveCodeGraphStudioService,
} from "@/microapps/codegraph/index.js";
import { getTestArtifactDir } from "@/test-support/artifacts.js";
import { resolveHarnessToolExposure } from "./exposure.js";
import {
  clearHarnessRegistry,
  listCapabilityDefinitions,
} from "./registry.js";
import { initializeHarnessRuntime, resetHarnessRuntime } from "./runtime.js";

const fixturePath = path.resolve(
  "src/mcp/managed-codegraph/__tests__/fixtures/fake-codegraph-provider.mjs",
);

const storageRoot = getTestArtifactDir("harness-runtime-codegraph-storage");
const appDataRoot = getTestArtifactDir("harness-runtime-codegraph-appdata");
let activeWorkspaceRoot = "";
let activeService: ReturnType<typeof createCodeGraphStudioService> | null = null;

describe("initializeHarnessRuntime codebase_explore registration", () => {
  afterEach(() => {
    void activeService?.stop();
    activeService = null;
    setActiveCodeGraphStudioService(null);
    clearHarnessRegistry();
    resetHarnessRuntime();
    fs.rmSync(storageRoot, { recursive: true, force: true });
    fs.rmSync(appDataRoot, { recursive: true, force: true });
  });

  it("keeps codebase_explore hidden by default", () => {
    initializeHarnessRuntime();

    expect(listCapabilityDefinitions().map((definition) => definition.id)).not.toContain(
      "codebase_explore",
    );

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "请梳理 agent planner 和 tool node 的关系",
    });
    expect(decision.exposedToolIds).not.toContain("codebase_explore");
  });

  it("registers only the controlled codebase_explore schema after the fake provider is ready and explicitly enabled", async () => {
    fs.mkdirSync(storageRoot, { recursive: true });
    activeWorkspaceRoot = getTestArtifactDir(`harness-runtime-codegraph-workspace-${Date.now()}`);
    fs.mkdirSync(activeWorkspaceRoot, { recursive: true });
    fs.mkdirSync(appDataRoot, { recursive: true });

    activeService = createCodeGraphStudioService({
      workspaceRoot: activeWorkspaceRoot,
      storageRoot,
      getCapabilityRegistrationState: () =>
        listCapabilityDefinitions().some((item) => item.id === "codebase_explore"),
    });
    setActiveCodeGraphStudioService(activeService);
    activeService.saveConfig({
      microAppEnabled: true,
      agentCapabilityEnabled: true,
      command: process.execPath,
      startArgs: [fixturePath, "--mcp"],
      versionProbeArgs: [fixturePath, "--version"],
      telemetryProbeArgs: [fixturePath, "--telemetry-status"],
      appDataRoot,
    });
    await activeService.start();
    await activeService.health();

    initializeHarnessRuntime();

    const definition = listCapabilityDefinitions().find(
      (item) => item.id === "codebase_explore",
    );

    expect(definition).toBeDefined();
    expect(definition?.inputSchema).toEqual({
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
      },
      additionalProperties: false,
    });
    expect(definition?.tags).toContain("codegraph");
    expect(definition?.tags).toContain("verification");

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "梳理 codebase architecture impact flow",
    });
    expect(decision.exposedToolIds).toContain("codebase_explore");
    expect(
      decision.exposedToolIds.filter((toolId) => toolId.includes("codegraph/")),
    ).toEqual([]);
    expect(
      listCapabilityDefinitions()
        .map((item) => item.id)
        .filter((toolId) => toolId.startsWith("codegraph/")),
    ).toEqual([]);
  });
});
