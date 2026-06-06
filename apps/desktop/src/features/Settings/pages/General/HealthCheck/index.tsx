import { useEffect, useState } from "react";
import Card from "../../../components/Card";

function HealthCheck() {
  const desktopApi = globalThis.window?.desktopApi;
  const [backendState, setBackendState] = useState<{
    status: "unknown" | "running" | "stopped";
    detail: string;
  }>({
    status: desktopApi ? "unknown" : "stopped",
    detail: desktopApi ? "等待后端健康检查" : "浏览器预览未连接本地后端",
  });
  const [databaseState, setDatabaseState] = useState<{
    status: "unknown" | "running" | "stopped";
    detail: string;
  }>({
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

    const pollBackend = async () => {
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

    void pollBackend();

    const timer = globalThis.setInterval(() => {
      void pollBackend();
    }, 3000);

    return () => {
      cancelled = true;
      globalThis.clearInterval(timer);
    };
  }, [desktopApi]);

  let statusLabel = "检测中";

  if (backendState.status === "running") {
    statusLabel = "运行中";
  } else if (backendState.status === "stopped") {
    statusLabel = "未启动";
  }

  let statusColorClass = "bg-amber-500";

  if (backendState.status === "running") {
    statusColorClass = "bg-green-600";
  } else if (backendState.status === "stopped") {
    statusColorClass = "bg-red-600";
  }

  let dbStatusLabel = "检测中";

  if (databaseState.status === "running") {
    dbStatusLabel = "正常";
  } else if (databaseState.status === "stopped") {
    dbStatusLabel = "未联通";
  }

  let dbStatusColorClass = "bg-amber-500";

  if (databaseState.status === "running") {
    dbStatusColorClass = "bg-green-600";
  } else if (databaseState.status === "stopped") {
    dbStatusColorClass = "bg-red-600";
  }

  return (
    <div className="w-full pb-4">
      {/* 顶部说明 */}
      <div className="space-y-2">
        <h3 className="text-md font-semibold tracking-tight text-gray-900 dark:text-white">
          环境检查
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          一个面向企业知识库验证的 Electron
          桌面应用初始化项目，支持本地和远程模型、向量数据库双模式切换。
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          运行环境：
          {desktopApi ? (
            <span className="text-gray-700 dark:text-gray-300">
              Electron ({desktopApi.platform})
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              Browser Preview
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {/* 后端状态 */}
        <Card
          label={
            <span>
              <span
                className={`
                  inline-block
        mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full
        ${statusColorClass}
        animate-pulse
      `}
              />
              &nbsp;&nbsp; 本地服务状态：{statusLabel}
            </span>
          }
          value={backendState.detail}
        />

        <Card
          label={
            <span>
              <span
                className={`
                  inline-block
        mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full
        ${dbStatusColorClass}
        animate-pulse
      `}
              />
              &nbsp;&nbsp; 数据库状态：{dbStatusLabel}
            </span>
          }
          value={databaseState.detail}
        />
      </div>
    </div>
  );
}

export default HealthCheck;
