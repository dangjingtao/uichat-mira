import {
  getActiveCodeGraphStudioService,
} from "@/microapps/codegraph/index.js";
import { codebaseExploreTool } from "@/mcp/managed-codegraph/codebase-explore.tool.js";
import {
  getCapabilityImplementation,
  registerCapability,
  unregisterCapability,
} from "./registry.js";

export const reconcileCodeGraphHarnessCapability = () => {
  const service = getActiveCodeGraphStudioService();
  const currentRegistration = Boolean(getCapabilityImplementation("codebase_explore"));

  if (!service) {
    if (currentRegistration) {
      unregisterCapability("codebase_explore");
    }
    return false;
  }

  const gate = service.getCapabilityGate();
  if (gate.available) {
    if (!currentRegistration) {
      registerCapability(codebaseExploreTool);
    }
    return true;
  }

  if (currentRegistration) {
    unregisterCapability("codebase_explore");
  }
  return false;
};
