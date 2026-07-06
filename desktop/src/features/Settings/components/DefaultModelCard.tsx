import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/Button";
import { forwardRef, useImperativeHandle } from "react";
import { Modal } from "@/shared/ui/Modal";
import type { RoleModelConfig } from "@/shared/api/modelSettings";
import ModelConfig from "./ModelConfig";
import PlatformConfigModal from "./PlatformConfigModal";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";
import { MODEL_ROLE_GROUPS } from "../pages/ModelSetting/roleMeta";

interface DefaultModelCardProps {
  onReady?: () => void;
}

interface DefaultModelCardRef {
  openPlatformSettings: () => void;
}

const DefaultModelCard = forwardRef<DefaultModelCardRef, DefaultModelCardProps>(
  ({ onReady }, ref) => {
    const { t } = useTranslation();
    const { configMap, loading, refresh } = useRoleModelConfigs();

    useEffect(() => {
      if (onReady) {
        onReady();
      }
    }, [onReady]);

    const handleConfigUpdated = (updated: RoleModelConfig) => {
      void updated;
      void refresh();
    };

    const openPlatformSettings = () => {
      let modalKey = "";

      modalKey = Modal.show({
        title: t("settings.model.defaultCard.platformSettingsTitle"),
        width: 940,
        height: 560,
        onClose: () => {
          void refresh();
        },
        footer: (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => Modal.close(modalKey)}
            >
              {t("settings.model.defaultCard.close")}
            </Button>
            <Button size="sm" onClick={() => Modal.close(modalKey)}>
              {t("settings.model.defaultCard.done")}
            </Button>
          </>
        ),
        content: (
          <PlatformConfigModal
            onRoleConfigUpdated={async () => {
              await refresh();
            }}
          />
        ),
      });
    };

    useImperativeHandle(ref, () => ({
      openPlatformSettings,
    }));

    return (
      <div className="space-y-3 pb-5">
        <div className="space-y-4">
          {MODEL_ROLE_GROUPS.map((group) => (
            <section
              key={group.id}
              className="rounded-2xl border border-border bg-surface-secondary/40 p-3"
            >
              <div className="mb-3 flex flex-col gap-1">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                  {t(group.titleKey)}
                </div>
                <div className="text-sm text-text-secondary">
                  {t(group.descriptionKey)}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {group.roles.map((item) => (
                  <ModelConfig
                    key={item.role}
                    modelType={item.role}
                    config={configMap[item.role]}
                    onUpdated={handleConfigUpdated}
                    readOnly={item.readOnly}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        {loading ? (
          <div className="text-xs text-text-secondary">
            {t("settings.model.defaultCard.syncing")}
          </div>
        ) : null}
      </div>
    );
  },
);

export default DefaultModelCard;
