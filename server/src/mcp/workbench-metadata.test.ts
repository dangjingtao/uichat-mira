import { describe, expect, it } from "vitest";
import type { McpToolDefinition } from "./core/definitions.js";
import { withWorkbenchMetadata } from "./workbench-metadata.js";

const createBrowserTool = (id: string): McpToolDefinition => ({
  id,
  title: id,
  description: id,
  domain: "browser_action",
  source: "internal",
  mode: "sync",
  inputSchema: {},
  tags: ["browser"],
  capabilities: {
    sideEffect: "none",
    requiresApproval: false,
  },
});

const createGitHubTool = (id: string): McpToolDefinition => ({
  id,
  title: id,
  description: id,
  domain: "github",
  source: "internal",
  mode: "sync",
  inputSchema: {},
  tags: ["github"],
  capabilities: {
    sideEffect: "network",
    requiresApproval: false,
    networkAccess: true,
  },
});

describe("withWorkbenchMetadata", () => {
  it("projects different capability-owned product groups for the same runtime domain", () => {
    const definitions = [
      createBrowserTool("browser_observe"),
      createBrowserTool("browser_act"),
      createBrowserTool("browser_assert"),
      createBrowserTool("browser_attached_look"),
      createBrowserTool("browser_attached_browse"),
      createBrowserTool("browser_attached_act"),
      createBrowserTool("browser_attached_transfer"),
    ];

    const projected = withWorkbenchMetadata(definitions);

    expect(projected.every((tool) => tool.domain === "browser_action")).toBe(true);
    expect(
      projected
        .filter((tool) => tool.workbench?.groupId === "browser_computer_use")
        .map((tool) => tool.id),
    ).toEqual(["browser_observe", "browser_act", "browser_assert"]);
    expect(
      projected
        .filter((tool) => tool.workbench?.groupId === "browser_attached")
        .map((tool) => tool.id),
    ).toEqual([
      "browser_attached_look",
      "browser_attached_browse",
      "browser_attached_act",
      "browser_attached_transfer",
    ]);
    expect(projected.find((tool) => tool.id === "browser_observe")?.workbench).toMatchObject({
      groupLabel: "Computer Use",
      groupOrder: 50,
    });
    expect(projected.find((tool) => tool.id === "browser_attached_look")?.workbench).toMatchObject({
      groupLabel: "触界",
      groupOrder: 60,
    });
  });

  it("uses complete registry ownership when projecting a filtered tool list", () => {
    const ownershipDefinitions = [
      createBrowserTool("browser_observe"),
      createBrowserTool("browser_act"),
      createBrowserTool("browser_assert"),
    ];

    expect(
      withWorkbenchMetadata(
        [createBrowserTool("browser_act")],
        ownershipDefinitions,
      )[0]?.workbench?.groupId,
    ).toBe("browser_computer_use");
  });

  it("groups GitHub read tools and supplies tool-specific parameter drafts", () => {
    const projected = withWorkbenchMetadata([
      createGitHubTool("github_repo_read"),
      createGitHubTool("github_issue_read"),
      createGitHubTool("github_pr_read"),
      createGitHubTool("github_actions_status"),
    ]);

    expect(projected.every((tool) => tool.workbench?.groupId === "github")).toBe(true);
    expect(projected[0]?.workbench).toMatchObject({
      groupLabel: "GitHub",
      groupOrder: 50,
      icon: "github",
      defaultArgs: {
        repository: "owner/repository",
        includeReadme: true,
        commitLimit: 5,
      },
    });
    expect(projected[1]?.workbench?.defaultArgs).toMatchObject({
      repository: "owner/repository",
      state: "open",
      limit: 20,
    });
    expect(projected[2]?.workbench?.defaultArgs).toMatchObject({
      repository: "owner/repository",
      state: "open",
      limit: 20,
    });
    expect(projected[3]?.workbench?.defaultArgs).toEqual({
      repository: "owner/repository",
      limit: 20,
      page: 1,
    });
  });
});
