import { useEffect, useState } from "react";
import { getSession } from "@/shared/lib/sessionStorage";

type RuntimeState = {
  status: "unknown" | "running" | "stopped";
  detail: string;
};

type RuntimeHealthSnapshot = {
  desktopApi: Window["desktopApi"];
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

const getDesktopApi = () => globalThis.window?.desktopApi;

const createInitialSnapshot = (): RuntimeHealthSnapshot => {
  const desktopApi = getDesktopApi();

  if (!desktopApi?.backendUrl) {
    return {
      desktopApi: undefined,
      backendState: createRuntimeState("stopped", "浏览器预览模式未连接本地后端"),
      databaseState: createRuntimeState(
        "stopped",
        "浏览器预览模式未连接本地数据库检查",
      ),
      vectorState: createRuntimeState(
        "stopped",
        "浏览器预览模式未连接本地向量数据库检查",
      ),
    };
  }

  return {
    desktopApi,
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

const fetchRuntimeHealth = async () => {
  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    const desktopApi = getDesktopApi();

    if (!desktopApi?.backendUrl) {
      setSnapshot(createInitialSnapshot());
      hasFetched = true;
      return;
    }

    const token = getSession()?.token;
    const backendResult = await desktopApi.checkBackendHealth(token);

    const nextBackendState = createRuntimeState(
      backendResult.success ? "running" : "stopped",
      backendResult.success
        ? `后端已启动 · ${desktopApi.backendUrl}`
        : backendResult.error ?? `健康检查失败 · HTTP ${backendResult.statusCode || 0}`,
    );

    const dbResult = await desktopApi.checkDatabaseHealth(token);

    const nextDatabaseState = createRuntimeState(
      dbResult.success && dbResult.ok ? "running" : "stopped",
      dbResult.detail ??
        (dbResult.success ? "数据库健康检查返回异常状态" : "健康检查失败"),
    );

    const nextVectorState = createRuntimeState(
      dbResult.success && dbResult.vectorStore.ok ? "running" : "stopped",
      dbResult.vectorStore.extensionPath
        ? `${dbResult.vectorStore.detail} · ${dbResult.vectorStore.extensionPath}`
        : dbResult.vectorStore.detail,
    );

    setSnapshot({
      desktopApi,
      backendState: nextBackendState,
      databaseState: nextDatabaseState,
      vectorState: nextVectorState,
    });
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
