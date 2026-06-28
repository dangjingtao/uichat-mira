import type { McpToolDefinition } from "@/mcp/core/definitions.js";
import type { CapabilityIntentDocument } from "./types.js";

const toCompactJson = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

const summarizeLegacyProjection = (
  definition: McpToolDefinition,
) => {
  const projection = definition.legacyProjection;
  if (!projection) {
    return "";
  }

  return [
    projection.category,
    projection.name,
    projection.author,
    projection.version,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");
};

export const toCapabilityIntentDocument = (
  definition: McpToolDefinition,
): CapabilityIntentDocument => {
  const schemaText = toCompactJson(definition.inputSchema);
  const legacyProjectionText = summarizeLegacyProjection(definition);
  const text = [
    definition.title,
    definition.id,
    definition.description,
    definition.domain,
    definition.tags.join(" "),
    legacyProjectionText,
    schemaText,
  ]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join("\n");

  return {
    capabilityId: definition.id,
    title: definition.title,
    text,
    source: definition.source,
    domain: definition.domain,
    tags: definition.tags,
  };
};

export const toCapabilityIntentDocuments = (
  definitions: McpToolDefinition[],
): CapabilityIntentDocument[] =>
  definitions.map(toCapabilityIntentDocument);
