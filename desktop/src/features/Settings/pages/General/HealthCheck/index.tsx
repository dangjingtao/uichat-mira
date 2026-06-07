import Card from "@/shared/ui/Card";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";

const statusTextMap = {
  unknown: "检测中",
  running: "运行中",
  stopped: "未启动",
} as const;

const databaseStatusTextMap = {
  unknown: "检测中",
  running: "正常",
  stopped: "未联通",
} as const;

const statusColorMap = {
  unknown: "bg-amber-500",
  running: "bg-green-600",
  stopped: "bg-red-600",
} as const;

function HealthCheck() {
  const { desktopApi, backendState, databaseState } = useRuntimeHealth();

  return (
    <div className="w-full pb-4">
      <div className="space-y-2">
        <h3 className="text-md font-semibold tracking-tight text-gray-900 dark:text-white">
          环境检查
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          当前页面用于确认桌面端是否已成功拉起本地服务，以及数据库是否处于可访问状态。
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

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card
          label={
            <span>
              <span
                className={`inline-block mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full animate-pulse ${statusColorMap[backendState.status]}`}
              />
              &nbsp;&nbsp; 本地服务状态：{statusTextMap[backendState.status]}
            </span>
          }
          value={backendState.detail}
        />

        <Card
          label={
            <span>
              <span
                className={`inline-block mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full animate-pulse ${statusColorMap[databaseState.status]}`}
              />
              &nbsp;&nbsp; 数据库状态：
              {databaseStatusTextMap[databaseState.status]}
            </span>
          }
          value={databaseState.detail}
        />
      </div>
    </div>
  );
}

export default HealthCheck;
