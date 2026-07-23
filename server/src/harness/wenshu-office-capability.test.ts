import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  resolveWenshuOfficePackRoot,
  resolveWenshuOfficeSitePackages,
} from "@/microapps/office-suite/runtime-pack-paths.js";
import { clearHarnessRegistry, listCapabilityDefinitions } from "./registry.js";
import {
  reconcileWenshuOfficeHarnessCapabilities,
  WENSHU_OPTIONAL_CAPABILITY_IDS,
} from "./wenshu-office-capability.js";

const previousRuntimePacksDir = process.env.MIRA_RUNTIME_PACKS_DIR;
let tempRoot = "";

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mira-wenshu-harness-test-"));
  process.env.MIRA_RUNTIME_PACKS_DIR = tempRoot;
  clearHarnessRegistry();
});

afterEach(() => {
  clearHarnessRegistry();
  fs.rmSync(tempRoot, { recursive: true, force: true });
  if (previousRuntimePacksDir === undefined) {
    delete process.env.MIRA_RUNTIME_PACKS_DIR;
  } else {
    process.env.MIRA_RUNTIME_PACKS_DIR = previousRuntimePacksDir;
  }
});

describe("WenShu Office Harness capability reconciliation", () => {
  it("keeps optional Office capabilities absent while the runtime pack is unavailable", () => {
    const state = reconcileWenshuOfficeHarnessCapabilities();

    expect(state.runtimePackAvailable).toBe(false);
    expect(state.registeredCapabilityIds).toEqual([]);
    expect(listCapabilityDefinitions().map((definition) => definition.id)).toEqual([]);
  });

  it("registers and removes optional Office capabilities from environment truth only", () => {
    const packRoot = resolveWenshuOfficePackRoot();
    fs.mkdirSync(resolveWenshuOfficeSitePackages(), { recursive: true });
    fs.writeFileSync(
      path.join(packRoot, "manifest.json"),
      JSON.stringify({ id: "wenshu-office", version: "1.0.0" }),
      "utf8",
    );

    const available = reconcileWenshuOfficeHarnessCapabilities();
    expect(available.runtimePackAvailable).toBe(true);
    expect(available.registeredCapabilityIds.sort()).toEqual(
      [...WENSHU_OPTIONAL_CAPABILITY_IDS].sort(),
    );
    expect(
      listCapabilityDefinitions()
        .map((definition) => definition.id)
        .filter((id) => WENSHU_OPTIONAL_CAPABILITY_IDS.includes(id)),
    ).toHaveLength(3);

    fs.rmSync(packRoot, { recursive: true, force: true });
    const unavailable = reconcileWenshuOfficeHarnessCapabilities();
    expect(unavailable.runtimePackAvailable).toBe(false);
    expect(
      listCapabilityDefinitions()
        .map((definition) => definition.id)
        .filter((id) => WENSHU_OPTIONAL_CAPABILITY_IDS.includes(id)),
    ).toEqual([]);
  });
});
