import type { McpToolDefinition } from "../../mcp/core/definitions.js";
import type { HarnessCapabilityProfile } from "./types.js";

const INTERNAL_PROFILE_BLUEPRINTS: Array<{
  id: string;
  title: string;
  description: string;
  domain: McpToolDefinition["domain"];
  tags: string[];
  preferredToolId: string;
  supportingToolIds: string[];
  actionProfileId?: string;
  actionProfileTitle?: string;
  actionProfileDescription?: string;
}> = [
  {
    id: "workspace_lookup",
    title: "Workspace Lookup",
    description:
      "Find, inspect, and read relevant workspace files and excerpts for the current task.",
    domain: "read",
    tags: ["workspace", "read", "lookup", "locate", "open"],
    preferredToolId: "read_locate",
    supportingToolIds: ["read", "read_list", "read_locate", "read_open", "read_extract", "read_slice"],
    actionProfileId: "read_locate",
  },
  {
    id: "codebase_understanding",
    title: "Codebase Understanding",
    description:
      "Explore codebase architecture, affected areas, and cross-file relationships through the controlled CodeGraph wrapper.",
    domain: "read",
    tags: [
      "codebase",
      "architecture",
      "dependency",
      "impact",
      "flow",
      "codegraph",
      "explore",
    ],
    preferredToolId: "codebase_explore",
    supportingToolIds: ["codebase_explore"],
  },
  {
    id: "workspace_edit",
    title: "Workspace Edit",
    description: "Modify workspace files through managed, structured workspace operations.",
    domain: "edit",
    tags: ["workspace", "edit", "write", "replace", "delete", "move", "rename", "mutation"],
    preferredToolId: "edit_file",
    supportingToolIds: ["workspace_mutation", "edit_file"],
    actionProfileId: "edit_create_file",
    actionProfileTitle: "Edit Create File",
    actionProfileDescription: "Create a new workspace file through managed file editing.",
  },
  {
    id: "web_research",
    title: "Web Research",
    description: "Search current public web information and summarize the findings.",
    domain: "web_search",
    tags: ["web", "search", "current", "realtime", "research"],
    preferredToolId: "web_search",
    supportingToolIds: ["web_search"],
  },
  {
    id: "terminal_execution",
    title: "Terminal Execution",
    description: "Run local terminal commands or inspect command output in the workspace runtime.",
    domain: "terminal",
    tags: ["terminal", "command", "shell", "process"],
    preferredToolId: "terminal_session",
    supportingToolIds: ["terminal_session"],
    actionProfileId: "terminal_execute_command",
    actionProfileTitle: "Terminal Execute Command",
    actionProfileDescription: "Execute a controlled terminal command through the managed terminal runtime.",
  },
];

const createFallbackProfile = (
  definition: McpToolDefinition,
): HarnessCapabilityProfile => ({
  id: definition.id,
  title: definition.title,
  description: definition.description,
  domain: definition.domain,
  source: definition.source,
  tags: definition.tags,
  preferredToolId: definition.id,
  supportingToolIds: [definition.id],
});

export const resolveHarnessCapabilityProfiles = (
  definitions: McpToolDefinition[],
): HarnessCapabilityProfile[] => {
  const definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
  const consumed = new Set<string>();

  const profiles: HarnessCapabilityProfile[] = [];

  for (const blueprint of INTERNAL_PROFILE_BLUEPRINTS) {
    const matchedToolIds = blueprint.supportingToolIds.filter((toolId) => definitionMap.has(toolId));
    if (matchedToolIds.length === 0 || !definitionMap.has(blueprint.preferredToolId)) {
      continue;
    }

    matchedToolIds.forEach((toolId) => consumed.add(toolId));
    profiles.push({
      id: blueprint.id,
      title: blueprint.title,
      description: blueprint.description,
      domain: blueprint.domain,
      source: "internal",
      tags: blueprint.tags,
      preferredToolId: blueprint.preferredToolId,
      supportingToolIds: matchedToolIds,
      ...(blueprint.actionProfileId
        ? {
            actionProfileId: blueprint.actionProfileId,
            actionProfileTitle: blueprint.actionProfileTitle,
            actionProfileDescription: blueprint.actionProfileDescription,
          }
        : {}),
    });
  }

  for (const definition of definitions) {
    if (consumed.has(definition.id)) {
      continue;
    }
    profiles.push(createFallbackProfile(definition));
  }

  return profiles;
};
