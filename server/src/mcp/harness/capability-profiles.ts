import type { McpToolDefinition } from "../core/definitions.js";

export interface HarnessCapabilityProfile {
  id: string;
  title: string;
  description: string;
  domain: McpToolDefinition["domain"];
  source: "internal" | "external";
  tags: string[];
  preferredToolId: string;
  supportingToolIds: string[];
}

const INTERNAL_PROFILE_BLUEPRINTS: Array<{
  id: string;
  title: string;
  description: string;
  domain: McpToolDefinition["domain"];
  tags: string[];
  preferredToolId: string;
  supportingToolIds: string[];
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
  },
  {
    id: "workspace_edit",
    title: "Workspace Edit",
    description: "Modify workspace files through managed, structured workspace operations.",
    domain: "edit",
    tags: ["workspace", "edit", "write", "replace", "delete", "move", "rename", "mutation"],
    preferredToolId: "workspace_mutation",
    supportingToolIds: ["workspace_mutation", "edit_file"],
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
  },
  {
    id: "wecom_notification",
    title: "WeCom Notification",
    description: "Send WeCom notifications or operational updates through configured integrations.",
    domain: "browser_action",
    tags: ["wecom", "notify", "message", "integration"],
    preferredToolId: "wecom_notify_send",
    supportingToolIds: ["wecom_notify_send"],
  },
  {
    id: "wecom_directory_lookup",
    title: "WeCom Directory Lookup",
    description: "Look up WeCom organization structure and contact context.",
    domain: "browser_action",
    tags: ["wecom", "directory", "lookup", "org", "contact"],
    preferredToolId: "wecom_org_lookup",
    supportingToolIds: ["wecom_org_lookup"],
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
