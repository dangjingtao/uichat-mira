import {
  getActiveCodeGraphStudioService,
} from "@/microapps/codegraph/index.js";
import { codebaseExploreTool } from "@/mcp/managed-codegraph/codebase-explore.tool.js";
import {
  canUseDeclaredRepoLocalCodeGraphCapability,
} from "@/mcp/managed-codegraph/repo-local-capability.js";
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
  const available =
    gate.available || canUseDeclaredRepoLocalCodeGraphCapability(gate);

  if (available) {
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
