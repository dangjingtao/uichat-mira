import { useTranslation } from "react-i18next";
import DefaultModelCard from "../../components/DefaultModelCard";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import { Button } from "@/shared/ui/Button";
import { RotateCcw } from "lucide-react";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import { resetProviderRoleModel } from "@/shared/api/modelSettings";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";

export default function ModelSettings() {
  const { t } = useTranslation();
  const { refresh } = useRoleModelConfigs();

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
