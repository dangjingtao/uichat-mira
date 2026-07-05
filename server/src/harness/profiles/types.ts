import type { McpToolDefinition } from "../../mcp/core/definitions.js";
import type { HarnessDefinitionSource } from "../shared/types.js";

export interface HarnessCapabilityProfile {
  id: string;
  title: string;
  description: string;
  domain: McpToolDefinition["domain"];
  source: HarnessDefinitionSource;
  tags: string[];
  preferredToolId: string;
  supportingToolIds: string[];
  actionProfileId?: string;
  actionProfileTitle?: string;
  actionProfileDescription?: string;
}
