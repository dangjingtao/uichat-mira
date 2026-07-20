import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearHarnessRegistry,
  listCapabilityDefinitions,
} from "./registry.js";
import {
  initializeHarnessRuntime,
  resetHarnessRuntime,
} from "./runtime.js";

describe("public edit tool surface", () => {
  beforeEach(() => {
    resetHarnessRuntime();
    clearHarnessRegistry();
  });

  afterEach(() => {
    resetHarnessRuntime();
    clearHarnessRegistry();
  });

  it("exposes exactly four direct edit actions without edit_file/workspace_mutation wrappers", () => {
    initializeHarnessRuntime();

    const editToolIds = listCapabilityDefinitions()
      .filter((definition) => definition.domain === "edit")
      .map((definition) => definition.id)
      .sort();

    expect(editToolIds).toEqual([
      "delete_path",
      "move_path",
      "replace_block",
      "write_file",
    ]);
    expect(editToolIds).not.toContain("edit_file");
    expect(editToolIds).not.toContain("workspace_mutation");
  });
});
