import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const [exportingLogs, setExportingLogs] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);

  const handleExportLogs = async () => {
    try {
      setExportingLogs(true);
      const archive = await exportBackendLogs();
      downloadBlob(archive.blob, archive.fileName);
      message.success(t("settings.general.health.logs.exportSuccess"));
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : t("settings.general.health.logs.exportFailed"),
      );
    } finally {
      setExportingLogs(false);
    }
  };

  const handleClearLogs = () => {
    Modal.confirm({
      title: t("settings.general.health.logs.clearTitle"),
      description: t("settings.general.health.logs.clearDescription"),
      tone: "danger",
      confirmText: t("settings.general.health.logs.clearConfirm"),
      cancelText: t("common.actions.cancel"),
      onConfirm: async () => {
        try {
          setClearingLogs(true);
          const result = await clearBackendLogs();
          const clearedBytes = result.clearedFiles.reduce(
            (sum, file) => sum + file.previousSize,
            0,
          );
          message.success(
            t("settings.general.health.logs.clearSuccess", {
              size: (clearedBytes / 1024).toFixed(1),
            }),
          );
        } catch (error) {
          message.error(
            error instanceof Error
              ? error.message
              : t("settings.general.health.logs.clearFailed"),
          );
        } finally {
          setClearingLogs(false);
        }
      },
      onCancel: () => void 0,
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
        {exportingLogs
          ? t("settings.general.health.logs.exporting")
          : t("settings.general.health.logs.export")}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 self-start"
        onClick={handleClearLogs}
        disabled={clearingLogs}
      >
        <Trash2 className="h-4 w-4" />
        {t("settings.general.health.logs.clear")}
      </Button>
    </div>
  );
}
