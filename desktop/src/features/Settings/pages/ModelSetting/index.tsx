import { useTranslation } from "react-i18next";
import DefaultModelCard from "../../components/DefaultModelCard";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import { Button } from "@/shared/ui/Button";
import { RotateCcw, Settings2 } from "lucide-react";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import { resetProviderRoleModel } from "@/shared/api/modelSettings";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import { useRef, useState } from "react";

export default function ModelSettings() {
  const { t } = useTranslation();
  const childRef = useRef<{ openPlatformSettings: () => void }>(null);
  const { refresh } = useRoleModelConfigs();
  const [ready, setReady] = useState(false);

  const handleClick = () => {
    if (!ready) return;
    childRef.current?.openPlatformSettings();
  };

  const handleResetAllDefaults = async () => {
    const modalKey = Modal.show({
      title: t("settings.model.resetModal.title"),
      width: 460,
      content: (
        <div className="space-y-3 text-sm text-text-secondary">
          <p>{t("settings.model.resetModal.description")}</p>
          <div className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3 text-danger">
            {t("settings.model.resetModal.warning")}
          </div>
        </div>
      ),
      footer: (
        <>
          <Button variant="ghost" onClick={() => Modal.close(modalKey)}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              try {
                Modal.close(modalKey);
                await Promise.all([
                  resetProviderRoleModel("llm"),
                  resetProviderRoleModel("embedding"),
                  resetProviderRoleModel("rerank"),
                  resetProviderRoleModel("task"),
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
            }}
          >
            {t("settings.model.actions.confirmReset")}
          </Button>
        </>
      ),
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
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClick}
            className="gap-2 self-start"
          >
            <Settings2 className="h-4 w-4" />
            {t("settings.model.actions.openSettings")}
          </Button>
        </div>
      }
      contentClassName="pt-6"
    >
      <div className="min-w-0">
        <DefaultModelCard onReady={() => setReady(true)} ref={childRef} />
      </div>
    </SettingsPageLayout>
  );
}
