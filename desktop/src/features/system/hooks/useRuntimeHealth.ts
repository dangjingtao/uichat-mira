import { useEffect, useState } from "react";

type RuntimeState = {
  status: "unknown" | "running" | "stopped";
  detail: string;
};

const createInitialState = (
  isDesktopRuntime: boolean,
  readyDetail: string,
  browserDetail: string,
): RuntimeState => ({
  status: isDesktopRuntime ? "unknown" : "stopped",
  detail: isDesktopRuntime ? readyDetail : browserDetail,
});

export function useRuntimeHealth() {
  const desktopApi = globalThis.window?.desktopApi;
  const isDesktopRuntime = Boolean(desktopApi?.backendUrl);

  const [backendState, setBackendState] = useState<RuntimeState>(() =>
    createInitialState(
      isDesktopRuntime,
      "等待后端健康检查",
      "浏览器预览未连接本地后端",
    ),
  );

  const [databaseState, setDatabaseState] = useState<RuntimeState>(() =>
    createInitialState(
      isDesktopRuntime,
      "等待数据库连通检查",
      "浏览器预览未连接本地数据库检查",
    ),
  );

  useEffect(() => {
    if (!isDesktopRuntime || !desktopApi) {
      setBackendState(
        createInitialState(false, "等待后端健康检查", "浏览器预览未连接本地后端"),
      );
      setDatabaseState(
        createInitialState(
          false,
          "等待数据库连通检查",
          "浏览器预览未连接本地数据库检查",
        ),
      );
      return;
    }

    let cancelled = false;

    const pollRuntime = async () => {
      const result = await desktopApi.checkBackendHealth();

      if (cancelled) {
        return;
      }

      setBackendState({
        status: result.success ? "running" : "stopped",
        detail: result.success
          ? `后端已启动 · ${desktopApi.backendUrl}`
          : (result.error ?? `健康检查失败 · HTTP ${result.statusCode || 0}`),
      });

      const dbResult = await desktopApi.checkDatabaseHealth();

      if (cancelled) {
        return;
      }

      setDatabaseState({
        status: dbResult.success && dbResult.ok ? "running" : "stopped",
        detail:
          dbResult.detail ??
          (dbResult.success ? "数据库健康检查返回异常状态" : "健康检查失败"),
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
  }, [desktopApi, isDesktopRuntime]);

  return {
    desktopApi: isDesktopRuntime ? desktopApi : undefined,
    backendState,
    databaseState,
  };
}
