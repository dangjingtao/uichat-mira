import type {
  McpResourceDefinition,
  McpResourceImplementation,
  McpToolDefinition,
  McpToolImplementation,
} from "../core/definitions.js";
import {
  clearRegistry,
  getResourceImplementation,
  getToolImplementation,
  listResourceDefinitions,
  listToolDefinitions,
  registerResource,
  registerTool,
  unregisterTool,
} from "../core/registry.js";

export const registerCapability = (capability: McpToolImplementation) =>
  registerTool(capability);

export const unregisterCapability = (capabilityId: string) =>
  unregisterTool(capabilityId);

export const registerReadableResource = (resource: McpResourceImplementation) =>
  registerResource(resource);

export const listCapabilityDefinitions = (): McpToolDefinition[] =>
  listToolDefinitions();

export const listInternalCapabilityDefinitions = (): McpToolDefinition[] =>
  listToolDefinitions().filter((definition) => definition.source === "internal");

export const listReadableResourceDefinitions = (): McpResourceDefinition[] =>
  listResourceDefinitions();

export const getCapabilityImplementation = (capabilityId: string) =>
  getToolImplementation(capabilityId);

export const getReadableResourceImplementation = (resourceId: string) =>
  getResourceImplementation(resourceId);

export const clearHarnessRegistry = () => clearRegistry();
