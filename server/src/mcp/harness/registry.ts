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
} from "../core/registry.js";

export const registerCapability = (capability: McpToolImplementation) =>
  registerTool(capability);

export const registerReadableResource = (resource: McpResourceImplementation) =>
  registerResource(resource);

export const listCapabilityDefinitions = (): McpToolDefinition[] =>
  listToolDefinitions();

export const listReadableResourceDefinitions = (): McpResourceDefinition[] =>
  listResourceDefinitions();

export const getCapabilityImplementation = (capabilityId: string) =>
  getToolImplementation(capabilityId);

export const getReadableResourceImplementation = (resourceId: string) =>
  getResourceImplementation(resourceId);

export const clearHarnessRegistry = () => clearRegistry();
