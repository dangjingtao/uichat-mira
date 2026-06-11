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
  detail: string;
};

type RuntimeHealthSnapshot = {
  runtime: DesktopRuntimeInfo;
  backendState: RuntimeState;
  databaseState: RuntimeState;
  vectorState: RuntimeState;
};

const createRuntimeState = (
  status: RuntimeState["status"],
  detail: string,
): RuntimeState => ({
  status,
  detail,
});

const createInitialSnapshot = (): RuntimeHealthSnapshot => {
  const runtime = getDesktopRuntime();

  if (isDesktopShell(runtime) && !runtime.backendUrl) {
    return {
      runtime,
      backendState: createRuntimeState("stopped", "桌面运行时未连接本地后端"),
      databaseState: createRuntimeState("stopped", "桌面运行时未连接数据库检查"),
      vectorState: createRuntimeState("stopped", "桌面运行时未连接向量数据库检查"),
    };
  }

  return {
    runtime,
    backendState: createRuntimeState("unknown", "等待后端健康检查"),
    databaseState: createRuntimeState("unknown", "等待数据库连通检查"),
    vectorState: createRuntimeState("unknown", "等待向量数据库检查"),
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
  createRuntimeState(
    dbResult.ok ? "running" : "stopped",
    dbResult.detail || "数据库健康检查返回异常状态",
  );

const createVectorState = (dbResult: DatabaseHealthData): RuntimeState =>
  createRuntimeState(
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
          `后端已启动 · ${runtime.backendUrl || window.location.origin}`,
        ),
        databaseState: createDatabaseState(dbResult),
        vectorState: createVectorState(dbResult),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "健康检查失败";

      setSnapshot({
        runtime,
        backendState: createRuntimeState("stopped", detail),
        databaseState: createRuntimeState("stopped", "后端不可访问，无法检查数据库状态"),
        vectorState: createRuntimeState("stopped", "后端不可访问，无法检查向量扩展状态"),
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
