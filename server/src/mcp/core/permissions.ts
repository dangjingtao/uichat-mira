import type { McpCapabilityMetadata } from "./definitions.js";

export const describeRisk = (capabilities: McpCapabilityMetadata) => {
  if (capabilities.sideEffect === "process") {
    return "high";
  }

  if (capabilities.sideEffect === "local-write") {
    return "high";
  }

  if (capabilities.sideEffect === "network") {
    return "medium";
  }

  return "low";
};

