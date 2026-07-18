import { describe, expect, it } from "vitest";

import { terminalSessionTool } from "../terminal-session.tool.js";

describe("terminal_session host runtime metadata", () => {
  it("keeps approval but no longer requires sandbox execution", () => {
    expect(terminalSessionTool.definition.capabilities.requiresApproval).toBe(true);
    expect(terminalSessionTool.definition.capabilities.sandboxRequired).toBe(false);
    expect(terminalSessionTool.definition.capabilities.sandboxProfile).toBeUndefined();
  });

  it("describes cwd as a host execution directory instead of a workspace-only jail", () => {
    const properties = terminalSessionTool.definition.inputSchema.properties as Record<
      string,
      { description?: string }
    >;

    expect(properties.cwd?.description).toMatch(/absolute paths/i);
    expect(properties.cwd?.description).toMatch(/approval/i);
  });
});
