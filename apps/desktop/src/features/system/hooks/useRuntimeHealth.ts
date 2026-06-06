import { useEffect, useState } from "react";

type RuntimeState = {
  status: "unknown" | "running" | "stopped";
  detail: string;
};

export function useRuntimeHealth() {
  const desktopApi = globalThis.window?.desktopApi;

  const [backendState, setBackendState] = useState<RuntimeState>({
    status: desktopApi ? "unknown" : "stopped",
    detail: desktopApi ? "等待后端健康检查" : "浏览器预览未连接本地后端",
  });

  const [databaseState, setDatabaseState] = useState<RuntimeState>({
    status: desktopApi ? "unknown" : "stopped",
    detail: desktopApi
      ? "等待数据库联通检查"
      : "浏览器预览未连接本地数据库检查",
  });

  useEffect(() => {
    if (!desktopApi?.checkBackendHealth) {
      return;
    }

    let cancelled = false;

    const pollRuntime = async () => {
      const result = await desktopApi.checkBackendHealth();

      if (cancelled) {
        return;
      }

      setBackendState({
        status: result.ok ? "running" : "stopped",
        detail: result.ok
          ? `后端已启动 · ${desktopApi.backendUrl}`
          : (result.error ?? `健康检查失败 · HTTP ${result.statusCode || 0}`),
      });

      if (!desktopApi.checkDatabaseHealth) {
        setDatabaseState({
          status: "stopped",
          detail: "当前桌面桥接未提供数据库健康检查能力",
        });
        return;
      }

      const dbResult = await desktopApi.checkDatabaseHealth();

      if (cancelled) {
        return;
      }

      setDatabaseState({
        status: dbResult.ok ? "running" : "stopped",
        detail: dbResult.ok
          ? `数据库联通正常 · ${dbResult.detail}`
          : dbResult.detail,
      });
    };

    void pollRuntime();

    const timer = globalThis.setInterval(() => {
      void pollRuntime();
    }, 3000);

    return () => {
      cancelled = true;
      globalThis.clearInterval(timer);
    };
  }, [desktopApi]);

  return {
    desktopApi,
    backendState,
    databaseState,
  };
}
