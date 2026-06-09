import { useState } from "react";
import Card from "@/shared/ui/Card";
import Tooltip from "@/shared/ui/Tooltip";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";
import { Button } from "@/shared/ui/Button";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import { clearBackendLogs, exportBackendLogs } from "@/shared/api/logs";
import {
  CircleHelp,
  Database,
  Download,
  Logs,
  MonitorCog,
  Server,
  Trash2,
} from "lucide-react";

function DetailTooltip({ text }: { text: string }) {
  return (
    <Tooltip text={text} placement="top">
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-icon-secondary transition-colors duration-150 hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        aria-label="查看详情"
      >
        <CircleHelp className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}

function HealthStatusCard({
  title,
  summary,
  detail,
  status,
  icon,
}: {
  title: string;
  summary: string;
  detail: string;
  status: "unknown" | "running" | "stopped";
  icon: React.ReactNode;
}) {
  return (
    <Card interactive className="h-full">
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary">
            {icon}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-base font-semibold text-text-primary">{title}</h4>
              <StatusIndicator status={status} />
            </div>
            <div className="flex items-center gap-2">
              <p className="truncate text-sm leading-6 text-text-secondary">{summary}</p>
              <DetailTooltip text={detail} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

function HealthCheck() {
  const { desktopApi, backendState, databaseState, vectorState } =
    useRuntimeHealth();
  const [exportingLogs, setExportingLogs] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const handleExportLogs = async () => {
    try {
      setExportingLogs(true);
      const archive = await exportBackendLogs();
      downloadBlob(archive.blob, archive.fileName);
      message.success("日志压缩包已开始下载");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "导出日志失败");
    } finally {
      setExportingLogs(false);
    }
  };

  const handleClearLogs = () => {
    const modalKey = Modal.show({
      title: "确认清空日志",
      width: 460,
      content: (
        <div className="space-y-3 text-sm text-text-secondary">
          <p>这会清空 `server.log` 和 `error.log` 的现有内容。</p>
          <div className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3 text-danger">
            日志文件会保留，但内容会被移除。此操作不可撤销。
          </div>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" onClick={() => Modal.close(modalKey)}>
            取消
          </Button>
          <Button
            variant="danger"
            disabled={clearingLogs}
            onClick={async () => {
              try {
                setClearingLogs(true);
                const result = await clearBackendLogs();
                Modal.close(modalKey);
                const clearedBytes = result.clearedFiles.reduce(
                  (sum, file) => sum + file.previousSize,
                  0,
                );
                message.success(
                  `日志已清空，共释放 ${(clearedBytes / 1024).toFixed(1)} KB`,
                );
              } catch (error) {
                message.error(error instanceof Error ? error.message : "清空日志失败");
              } finally {
                setClearingLogs(false);
              }
            }}
          >
            确认清空
          </Button>
        </>
      ),
    });
  };

  return (
    <section className="space-y-4">
      <div className="space-y-2">
        <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Runtime Health
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-semibold text-text-primary">环境检查</h3>
          <p className="max-w-2xl text-sm leading-6 text-text-secondary">
            用于确认当前桌面端是否已经连接本地后端，以及数据库与向量数据库是否处于可访问状态。
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
              {desktopApi ? `Electron · ${desktopApi.platform}` : "Browser Preview"}
            </div>
            <div className="text-sm text-text-secondary">
              {desktopApi
                ? "桌面运行时已接入本地健康检查能力。"
                : "当前为浏览器预览模式，无法直接访问桌面本地能力。"}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HealthStatusCard
          title="Server"
          summary={backendState.status === "running" ? "后端运行正常" : "后端暂不可访问"}
          detail={backendState.detail}
          status={backendState.status}
          icon={<Server className="h-5 w-5 text-icon-primary" />}
        />

        <HealthStatusCard
          title="SQLite"
          summary={databaseState.status === "running" ? "数据库可访问" : "数据库状态异常"}
          detail={databaseState.detail}
          status={databaseState.status}
          icon={<Database className="h-5 w-5 text-icon-primary" />}
        />

        <HealthStatusCard
          title="SQLite-vec"
          summary={vectorState.status === "running" ? "向量扩展已加载" : "向量扩展异常"}
          detail={vectorState.detail}
          status={vectorState.status}
          icon={<Database className="h-5 w-5 text-icon-primary" />}
        />
      </div>

      <Card className="bg-surface-primary">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary">
              <Logs className="h-5 w-5 text-icon-primary" />
            </div>
            <div className="space-y-1">
              <div className="text-base font-semibold text-text-primary">日志工具</div>
              <div className="text-sm leading-6 text-text-secondary">
                支持导出后端 `server.log` 与 `error.log` 压缩包，也可以一键清空当前日志。
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={() => void handleExportLogs()}
              disabled={exportingLogs}
            >
              <Download className="h-4 w-4" />
              {exportingLogs ? "导出中..." : "导出日志 ZIP"}
            </Button>
            <Button
              variant="ghost"
              className="text-danger hover:bg-danger/5 hover:text-danger"
              onClick={handleClearLogs}
              disabled={clearingLogs}
            >
              <Trash2 className="h-4 w-4" />
              清空日志
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}

export default HealthCheck;
