import { useEffect, useState } from "react";
import {
  getDatabaseHealth,
  getServiceHealth,
  type DatabaseHealthData,
} from "@/shared/api/system";
import {
  getDesktopRuntime,
  isDesktopShell,
  type DesktopRuntimeInfo,
} from "@/shared/platform/desktopRuntime";

type RuntimeState = {
  status: "unknown" | "running" | "stopped";
  detail?: string;
  detailKey?: string;
  detailValues?: Record<string, string>;
};

type RuntimeHealthSnapshot = {
  runtime: DesktopRuntimeInfo;
  backendState: RuntimeState;
  databaseState: RuntimeState;
  vectorState: RuntimeState;
};

const createRuntimeState = (
  status: RuntimeState["status"],
  detailOrKey: string,
  detailValues?: Record<string, string>,
  treatAsKey = true,
): RuntimeState => ({
  status,
  ...(treatAsKey
    ? { detailKey: detailOrKey, detailValues }
    : { detail: detailOrKey }),
});

const createRawRuntimeState = (
  status: RuntimeState["status"],
  detail: string,
) => ({
  status,
  detail,
});

const createInitialSnapshot = (): RuntimeHealthSnapshot => {
  const runtime = getDesktopRuntime();

  if (isDesktopShell(runtime) && !runtime.backendUrl) {
    return {
      runtime,
      backendState: createRuntimeState(
        "stopped",
        "settings.general.health.details.desktopBackendUnavailable",
      ),
      databaseState: createRuntimeState(
        "stopped",
        "settings.general.health.details.desktopDatabaseUnavailable",
      ),
      vectorState: createRuntimeState(
        "stopped",
        "settings.general.health.details.desktopVectorUnavailable",
      ),
    };
  }

  return {
    runtime,
    backendState: createRuntimeState(
      "unknown",
      "settings.general.health.details.waitingBackend",
    ),
    databaseState: createRuntimeState(
      "unknown",
      "settings.general.health.details.waitingDatabase",
    ),
    vectorState: createRuntimeState(
      "unknown",
      "settings.general.health.details.waitingVector",
    ),
  };
};

let snapshot: RuntimeHealthSnapshot = createInitialSnapshot();
let fetchPromise: Promise<void> | null = null;
let hasFetched = false;
const listeners = new Set<(next: RuntimeHealthSnapshot) => void>();

const emitSnapshot = () => {
  for (const listener of listeners) {
    listener(snapshot);
  }
};

const setSnapshot = (next: RuntimeHealthSnapshot) => {
  snapshot = next;
  emitSnapshot();
};

const createDatabaseState = (dbResult: DatabaseHealthData): RuntimeState =>
  dbResult.detail
    ? createRawRuntimeState(dbResult.ok ? "running" : "stopped", dbResult.detail)
    : createRuntimeState(
        dbResult.ok ? "running" : "stopped",
        "settings.general.health.details.databaseUnexpected",
      );

const createVectorState = (dbResult: DatabaseHealthData): RuntimeState =>
  createRawRuntimeState(
    dbResult.vectorStore.ok ? "running" : "stopped",
    dbResult.vectorStore.extensionPath
      ? `${dbResult.vectorStore.detail} · ${dbResult.vectorStore.extensionPath}`
      : dbResult.vectorStore.detail,
  );

const fetchRuntimeHealth = async () => {
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    const runtime = getDesktopRuntime();

    if (isDesktopShell(runtime) && !runtime.backendUrl) {
      setSnapshot(createInitialSnapshot());
      hasFetched = true;
      return;
    }

    try {
      await getServiceHealth();

      const dbResult = await getDatabaseHealth();

      setSnapshot({
        runtime,
        backendState: createRuntimeState(
          "running",
          "settings.general.health.details.backendRunning",
          {
            url: runtime.backendUrl || window.location.origin,
          },
        ),
        databaseState: createDatabaseState(dbResult),
        vectorState: createVectorState(dbResult),
      });
    } catch (error) {
      const backendState =
        error instanceof Error
          ? createRawRuntimeState("stopped", error.message)
          : createRuntimeState(
              "stopped",
              "settings.general.health.details.healthCheckFailed",
            );

      setSnapshot({
        runtime,
        backendState,
        databaseState: createRuntimeState(
          "stopped",
          "settings.general.health.details.backendUnavailableForDatabase",
        ),
        vectorState: createRuntimeState(
          "stopped",
          "settings.general.health.details.backendUnavailableForVector",
        ),
      });
    }

    hasFetched = true;
  })().finally(() => {
    fetchPromise = null;
  });

  return fetchPromise;
};

const ensureFetchedOnce = () => {
  if (hasFetched) {
    return;
  }

  void fetchRuntimeHealth();
};

const subscribe = (listener: (next: RuntimeHealthSnapshot) => void) => {
  listeners.add(listener);
  listener(snapshot);
  ensureFetchedOnce();

  return () => {
    listeners.delete(listener);
  };
};

export function useRuntimeHealth() {
  const [state, setState] = useState<RuntimeHealthSnapshot>(() => snapshot);

  useEffect(() => subscribe(setState), []);

  return state;
}
