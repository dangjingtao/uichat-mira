import Card from "@/shared/ui/Card";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";
import { Database, MonitorCog, Server } from "lucide-react";

function HealthCheck() {
  const { desktopApi, backendState, databaseState, vectorState } =
    useRuntimeHealth();

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Runtime Health
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-text-primary">环境检查</h3>
          <p className="max-w-2xl text-sm leading-6 text-text-secondary">
            用于确认当前桌面端是否已经拉起本地后端服务，以及数据库与向量数据库是否处于可访问状态。
          </p>
        </div>
      </div>

      <Card className="bg-surface-primary">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary">
            <MonitorCog className="h-5 w-5 text-icon-primary" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
              当前运行环境
            </div>
            <div className="text-sm font-medium text-text-primary">
              {desktopApi
                ? `Electron · ${desktopApi.platform}`
                : "Browser Preview"}
            </div>
            <div className="text-sm text-text-secondary">
              {desktopApi
                ? "桌面运行时已接入本地健康检查能力。"
                : "当前为浏览器预览模式，无法直接访问本地桌面运行时能力。"}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card interactive className="h-full">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary">
                <Server className="h-5 w-5 text-icon-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-text-primary">
                    Server
                  </h4>
                  <StatusIndicator status={backendState.status} />
                </div>
                <p className="text-sm leading-6 text-text-secondary">
                  {backendState.detail}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card interactive className="h-full">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary">
                <Database className="h-5 w-5 text-icon-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-text-primary">
                    SQLite
                  </h4>
                  <StatusIndicator status={databaseState.status} />
                </div>
                <p className="text-sm leading-6 text-text-secondary">
                  {databaseState.detail}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <Card interactive className="h-full">
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary">
                <Database className="h-5 w-5 text-icon-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-base font-semibold text-text-primary">
                    SQLite-vec
                  </h4>
                  <StatusIndicator status={vectorState.status} />
                </div>
                <p className="text-sm leading-6 text-text-secondary">
                  {vectorState.detail}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}

export default HealthCheck;
