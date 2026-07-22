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
});
