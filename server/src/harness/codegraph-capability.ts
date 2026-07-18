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

let managedLifecycleBusy = false;
let managedLifecyclePromise: Promise<unknown> | null = null;
let autoStartAttemptedFingerprint: string | null = null;

const disposeRepoLocalRuntime = () => {
  void disposeRepoLocalManagedCodeGraphManagers();
};

const beginManagedLifecycle = (
  task: () => Promise<unknown>,
  fingerprint: string,
) => {
  if (managedLifecycleBusy) {
    return;
  }
  managedLifecycleBusy = true;
  autoStartAttemptedFingerprint = fingerprint;
  managedLifecyclePromise = task()
    .catch(() => undefined)
    .finally(() => {
      managedLifecycleBusy = false;
      managedLifecyclePromise = null;
    });
};

const maybeBootstrapManagedRuntime = (
  service: NonNullable<ReturnType<typeof getActiveCodeGraphStudioService>>,
) => {
  const draft = service.getDraft();
  const hasSavedConfig = fs.existsSync(service.getStoragePath());
  const currentRegistration = Boolean(
    getCapabilityImplementation("codebase_explore"),
  );
  const rawGate = service.getCapabilityGate();
  const gate = normalizeDeclaredRepoLocalCapabilityGate(rawGate, {
    command: draft.command,
    capabilityRegistered: currentRegistration,
  });
  const fingerprint = JSON.stringify({
    command: draft.command,
    startArgs: draft.startArgs,
    versionProbeArgs: draft.versionProbeArgs,
    telemetryProbeArgs: draft.telemetryProbeArgs,
    appDataRoot: draft.appDataRoot,
  });

  if (
    !hasSavedConfig &&
    draft.microAppEnabled &&
    !draft.agentCapabilityEnabled &&
    !managedLifecycleBusy
  ) {
    beginManagedLifecycle(
      async () => {
        await service.saveConfig({
          agentCapabilityEnabled: true,
        });
        await service.start();
      },
      fingerprint,
    );
    return;
  }

  const shouldStart =
    draft.microAppEnabled &&
    isRealCodeGraphCommand(draft.command) &&
    gate.checks.appDataRootValid &&
    !gate.checks.runtimeReady &&
    !managedLifecycleBusy &&
    autoStartAttemptedFingerprint !== fingerprint;

  if (!shouldStart) {
    return;
  }

  beginManagedLifecycle(async () => await service.start(), fingerprint);
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
    managedLifecycleBusy = false;
    managedLifecyclePromise = null;
    autoStartAttemptedFingerprint = null;
    return false;
  }

  maybeBootstrapManagedRuntime(service);

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

export const getCodeGraphManagedLifecycleState = () => ({
  busy: managedLifecycleBusy,
  pending: Boolean(managedLifecyclePromise),
  attemptedFingerprint: autoStartAttemptedFingerprint,
});
