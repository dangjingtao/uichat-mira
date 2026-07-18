import fs from "node:fs";

import {
  getActiveCodeGraphStudioService,
} from "@/microapps/codegraph/index.js";
import {
  normalizeDeclaredRepoLocalCapabilityGate,
} from "@/microapps/codegraph/public-report.js";
import { codebaseExploreTool } from "@/mcp/managed-codegraph/codebase-explore.tool.js";
import {
  disposeRepoLocalManagedCodeGraphManagers,
} from "@/mcp/managed-codegraph/repo-local-manager-cache.js";
import {
  isRealCodeGraphCommand,
} from "@/mcp/managed-codegraph/repo-local-process-manager.js";
import {
  getCapabilityImplementation,
  registerCapability,
  unregisterCapability,
} from "./registry.js";

let freshInstallBootstrapBusy = false;

const disposeRepoLocalRuntime = () => {
  void disposeRepoLocalManagedCodeGraphManagers();
};

const maybeEnableFreshInstallCapability = (
  service: NonNullable<ReturnType<typeof getActiveCodeGraphStudioService>>,
) => {
  const draft = service.getDraft();
  if (
    freshInstallBootstrapBusy ||
    fs.existsSync(service.getStoragePath()) ||
    !draft.microAppEnabled ||
    draft.agentCapabilityEnabled
  ) {
    return;
  }

  freshInstallBootstrapBusy = true;
  void service
    .saveConfig({
      agentCapabilityEnabled: true,
    })
    .catch(() => undefined)
    .finally(() => {
      freshInstallBootstrapBusy = false;
    });
};

export const reconcileCodeGraphHarnessCapability = () => {
  const service = getActiveCodeGraphStudioService();
  const currentRegistration = Boolean(
    getCapabilityImplementation("codebase_explore"),
  );

  if (!service) {
    if (currentRegistration) {
      unregisterCapability("codebase_explore");
    }
    disposeRepoLocalRuntime();
    freshInstallBootstrapBusy = false;
    return false;
  }

  maybeEnableFreshInstallCapability(service);

  const draft = service.getDraft();
  const gate = normalizeDeclaredRepoLocalCapabilityGate(
    service.getCapabilityGate(),
    {
      command: draft.command,
      capabilityRegistered: currentRegistration,
    },
  );
  const lazyManagedWorkspaceAvailable =
    draft.microAppEnabled &&
    draft.agentCapabilityEnabled &&
    isRealCodeGraphCommand(draft.command) &&
    gate.checks.appDataRootValid;
  const available = gate.available || lazyManagedWorkspaceAvailable;

  if (available) {
    if (!currentRegistration) {
      registerCapability(codebaseExploreTool);
    }
    return true;
  }

  if (currentRegistration) {
    unregisterCapability("codebase_explore");
  }
  disposeRepoLocalRuntime();
  return false;
};
