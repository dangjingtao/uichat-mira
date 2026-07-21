import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  createCodeGraphStudioService,
  setActiveCodeGraphStudioService,
} from "@/microapps/codegraph/index.js";
import { getTestArtifactDir } from "@/test-support/artifacts.js";
import { reconcileCodeGraphHarnessCapability } from "./codegraph-capability.js";
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

  it("keeps codebase_explore registered by default", () => {
    initializeHarnessRuntime();

    expect(listCapabilityDefinitions().map((definition) => definition.id)).toContain(
      "codebase_explore",
    );

    const decision = resolveHarnessToolExposure({
      source: "agent_intent",
      query: "请梳理 agent planner 和 tool node 的关系",
    });
    expect(decision.exposedToolIds).toContain("codebase_explore");
  });

});
