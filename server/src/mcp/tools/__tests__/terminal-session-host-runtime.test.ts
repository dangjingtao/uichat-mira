import { describe, expect, it } from "vitest";

import { terminalSessionTool } from "../terminal-session.tool.js";

type SchemaProperty = {
  description?: string;
  enum?: readonly string[];
};

const getExposedProperties = (exposure: "agent_intent" | "chat_surface") =>
  terminalSessionTool.definition.inputSchemaByExposure?.[exposure]
    ?.properties as Record<string, SchemaProperty>;

describe("terminal_session host runtime metadata", () => {
  it("keeps approval but no longer requires sandbox execution", () => {
    expect(
      terminalSessionTool.definition.capabilities.requiresApproval,
    ).toBe(true);
    expect(
      terminalSessionTool.definition.capabilities.sandboxRequired,
    ).toBe(false);
    expect(
      terminalSessionTool.definition.capabilities.sandboxProfile,
    ).toBeUndefined();
  });

  it("describes cwd as a host execution directory instead of a workspace-only jail", () => {
    const properties = terminalSessionTool.definition.inputSchema
      .properties as Record<string, SchemaProperty>;

    expect(properties.cwd?.description).toMatch(/absolute paths/i);
    expect(properties.cwd?.description).toMatch(/approval/i);
  });

  it("exposes persistent PTY controls to Planner and chat surfaces", () => {
    for (const exposure of ["agent_intent", "chat_surface"] as const) {
      const properties = getExposedProperties(exposure);
      expect(properties.sessionMode?.enum).toEqual([
        "ephemeral",
        "persistent",
      ]);
      expect(properties.attachSessionId?.description).toMatch(/existing/i);
      expect(properties.env?.description).toMatch(/host environment/i);
    }
  });
});
