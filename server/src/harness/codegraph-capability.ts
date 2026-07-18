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

let managedAutoStart: Promise<unknown> | null = null;
let autoStartAttemptedFingerprint: string | null = null;

const disposeRepoLocalRuntime = () => {
  void disposeRepoLocalManagedCodeGraphManagers();
};

const maybeAutoStartManagedRuntime = (
  service: NonNullable<ReturnType<typeof getActiveCodeGraphStudioService>>,
) => {
  const draft = service.getDraft();
  const rawGate = service.getCapabilityGate();
  const gate = normalizeDeclaredRepoLocalCapabilityGate(rawGate, {
    command: draft.command,
    capabilityRegistered: Boolean(
      getCapabilityImplementation("codebase_explore"),
    ),
  });
  const fingerprint = JSON.stringify({
    command: draft.command,
    startArgs: draft.startArgs,
    versionProbeArgs: draft.versionProbeArgs,
    telemetryProbeArgs: draft.telemetryProbeArgs,
    appDataRoot: draft.appDataRoot,
  });
  const shouldStart =
    draft.microAppEnabled &&
    isRealCodeGraphCommand(draft.command) &&
    gate.checks.appDataRootValid &&
    !gate.checks.runtimeReady &&
    !managedAutoStart &&
    autoStartAttemptedFingerprint !== fingerprint;

  if (!shouldStart) {
    return;
  }

  autoStartAttemptedFingerprint = fingerprint;
  managedAutoStart = service
    .start()
    .catch(() => undefined)
    .finally(() => {
      managedAutoStart = null;
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
    managedAutoStart = null;
    autoStartAttemptedFingerprint = null;
    return false;
  }

  maybeAutoStartManagedRuntime(service);

  const draft = service.getDraft();
  const gate = normalizeDeclaredRepoLocalCapabilityGate(
    service.getCapabilityGate(),
    {
      command: draft.command,
      capabilityRegistered: currentRegistration,
    },
  );

  if (gate.available) {
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
