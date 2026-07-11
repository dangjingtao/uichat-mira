import { describe, expect, it } from "vitest";
import { resolveHarnessCapabilityProfiles } from "./capability-profiles.js";

describe("resolveHarnessCapabilityProfiles", () => {
  it("groups read family tools under one workspace capability profile", () => {
    const profiles = resolveHarnessCapabilityProfiles([
      {
        id: "read_discover",
        title: "Read Discover",
        description: "discover",
        domain: "read",
        source: "internal",
        mode: "sync",
        inputSchema: {},
        tags: ["read"],
        capabilities: {
          sideEffect: "none",
          requiresApproval: false,
        },
      },
      {
        id: "read_open",
        title: "Read Open",
        description: "open",
        domain: "read",
        source: "internal",
        mode: "sync",
        inputSchema: {},
        tags: ["read"],
        capabilities: {
          sideEffect: "none",
          requiresApproval: false,
        },
      },
    ]);

    expect(profiles).toEqual(
      expect.arrayContaining([
      expect.objectContaining({
          id: "workspace_lookup",
          preferredToolId: "read_open",
          supportingToolIds: ["read_discover", "read_open"],
        }),
      ]),
    );
  });

  it("exposes action profile metadata for terminal and edit capability groups", () => {
    const profiles = resolveHarnessCapabilityProfiles([
      {
        id: "terminal_session",
        title: "Terminal Session",
        description: "terminal",
        domain: "terminal",
        source: "internal",
        mode: "stream",
        inputSchema: {},
        tags: ["terminal"],
        capabilities: {
          sideEffect: "process",
          requiresApproval: true,
        },
      },
      {
        id: "edit_file",
        title: "Edit File",
        description: "edit",
        domain: "edit",
        source: "internal",
        mode: "sync",
        inputSchema: {},
        tags: ["edit"],
        capabilities: {
          sideEffect: "local-write",
          requiresApproval: true,
        },
      },
      {
        id: "workspace_mutation",
        title: "Workspace Mutation",
        description: "mutation",
        domain: "edit",
        source: "internal",
        mode: "sync",
        inputSchema: {},
        tags: ["edit"],
        capabilities: {
          sideEffect: "local-write",
          requiresApproval: true,
        },
      },
    ]);

    expect(profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "terminal_execution",
          preferredToolId: "terminal_session",
          actionProfileId: "terminal_execute_command",
        }),
        expect.objectContaining({
          id: "workspace_edit",
          preferredToolId: "edit_file",
          actionProfileId: "edit_create_file",
        }),
      ]),
    );
  });

  it("keeps unknown tools as one-to-one fallback profiles", () => {
    const profiles = resolveHarnessCapabilityProfiles([
      {
        id: "custom_internal_tool",
        title: "Custom Internal Tool",
        description: "custom",
        domain: "read",
        source: "internal",
        mode: "sync",
        inputSchema: {},
        tags: ["custom"],
        capabilities: {
          sideEffect: "none",
          requiresApproval: false,
        },
      },
    ]);

    expect(profiles).toEqual([
      expect.objectContaining({
        id: "custom_internal_tool",
        preferredToolId: "custom_internal_tool",
        supportingToolIds: ["custom_internal_tool"],
      }),
    ]);
  });
});
