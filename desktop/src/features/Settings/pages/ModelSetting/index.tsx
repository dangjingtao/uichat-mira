import { useRef, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import DefaultModelCard from "../../components/DefaultModelCard";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import { Button } from "@/shared/ui/Button";
import { Download, RotateCcw, Upload } from "lucide-react";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import {
  exportModelSettings,
  importModelSettings,
  resetProviderRoleModel,
  type ModelSettingsBackup,
} from "@/shared/api/modelSettings";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";

export default function ModelSettings() {
  const { t } = useTranslation();
  const { refresh } = useRoleModelConfigs();
  const importInputRef = useRef<HTMLInputElement>(null);

  const downloadBackup = (backup: ModelSettingsBackup) => {
    const date = backup.exportedAt.slice(0, 10);
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `uichat-mira-model-settings-${date}.json`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleExport = () => {
    Modal.confirm({
      title: t("settings.model.exportModal.title"),
      description: t("settings.model.exportModal.description"),
      confirmText: t("settings.model.actions.confirmExport"),
      cancelText: t("common.actions.cancel"),
      onConfirm: async () => {
        try {
          const backup = await exportModelSettings();
          downloadBackup(backup);
          message.success(t("settings.model.exportModal.success"));
        } catch (error) {
          message.error(
            error instanceof Error
              ? error.message
              : t("settings.model.exportModal.failed"),
          );
        }
      },
      onCancel: () => void 0,
    });
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    let backup: ModelSettingsBackup;
    try {
      backup = JSON.parse(await file.text()) as ModelSettingsBackup;
    } catch {
      message.error(t("settings.model.importModal.invalidFile"));
      return;
    }

    Modal.confirm({
      title: t("settings.model.importModal.title"),
      description: t("settings.model.importModal.description", {
        fileName: file.name,
      }),
      confirmText: t("settings.model.actions.confirmImport"),
      cancelText: t("common.actions.cancel"),
      onConfirm: async () => {
        try {
          const result = await importModelSettings(backup);
          await refresh();
          message.success(
            t("settings.model.importModal.success", {
              connectionCount: result.connectionCount,
              assignmentCount: result.assignmentCount,
            }),
          );
        } catch (error) {
          message.error(
            error instanceof Error
              ? error.message
              : t("settings.model.importModal.failed"),
          );
        }
      },
      onCancel: () => void 0,
    });
  };

  const handleResetAllDefaults = async () => {
    Modal.confirm({
      title: t("settings.model.resetModal.title"),
      description: t("settings.model.resetModal.description"),
      tone: "danger",
      confirmText: t("settings.model.actions.confirmReset"),
      cancelText: t("common.actions.cancel"),
      onConfirm: async () => {
        try {
          await Promise.all([
            resetProviderRoleModel("llm"),
            resetProviderRoleModel("embedding"),
            resetProviderRoleModel("rerank"),
            resetProviderRoleModel("task"),
            resetProviderRoleModel("agentTask"),
            resetProviderRoleModel("evaluation"),
          ]);
          await refresh();
          message.success(t("settings.model.resetModal.success"));
        } catch (error) {
          message.error(
            error instanceof Error
              ? error.message
              : t("settings.model.resetModal.failed"),
          );
        }
      },
      onCancel: () => void 0,
    });
  };

  return (
    <SettingsPageLayout
      miniTitle={t("settings.model.page.miniTitle")}
      title={t("settings.model.page.title")}
      description={t("settings.model.page.description")}
      slot={
        <div className="flex items-center gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            aria-label={t("settings.model.actions.import")}
            className="hidden"
            onChange={handleImportFile}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => importInputRef.current?.click()}
            className="gap-2 self-start"
          >
            <Upload className="h-4 w-4" />
            {t("settings.model.actions.import")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            className="gap-2 self-start"
          >
            <Download className="h-4 w-4" />
            {t("settings.model.actions.export")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetAllDefaults}
            className="gap-2 self-start"
          >
            <RotateCcw className="h-4 w-4" />
            {t("settings.model.actions.resetDefault")}
          </Button>
        </div>
      }
      contentClassName="pt-6"
    >
      <div className="min-w-0 flex">
        <DefaultModelCard />
      </div>
    </SettingsPageLayout>
  );
}
