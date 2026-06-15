import { useState } from "react";
import { Button } from "@/shared/ui/Button";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import { clearBackendLogs, exportBackendLogs } from "@/shared/api/logs";
import { Download, Trash2 } from "lucide-react";

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}

export default function LogButtons() {
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
                message.error(
                  error instanceof Error ? error.message : "清空日志失败",
                );
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        className="gap-2 self-start"
        onClick={() => void handleExportLogs()}
        disabled={exportingLogs}
      >
        <Download className="h-4 w-4" />
        {exportingLogs ? "导出中..." : "导出日志 ZIP"}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 self-start"
        onClick={handleClearLogs}
        disabled={clearingLogs}
      >
        <Trash2 className="h-4 w-4" />
        清空日志
      </Button>
    </div>
  );
}
