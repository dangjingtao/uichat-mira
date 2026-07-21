import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/Button";
import { forwardRef, useImperativeHandle } from "react";
import { Modal } from "@/shared/ui/Modal";
import type { RoleModelConfig } from "@/shared/api/modelSettings";
import ModelConfig from "./ModelConfig";
import PlatformConfigModal from "./PlatformConfigModal";
import { useRoleModelConfigs } from "@/app/providers/RoleModelConfigProvider";

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
      <div className="w-full space-y-3 pb-5">
        <div className="grid w-full grid-cols-2 gap-2 xl:gap-4">
          <ModelConfig
            modelType="llm"
            config={configMap.llm}
            onUpdated={handleConfigUpdated}
          />
          <ModelConfig
            modelType="task"
            config={configMap.task}
            onUpdated={handleConfigUpdated}
            readOnly
          />
          <ModelConfig
            modelType="agentTask"
            config={configMap.agentTask}
            onUpdated={handleConfigUpdated}
            readOnly
          />
          <ModelConfig
            modelType="evaluation"
            config={configMap.evaluation}
            onUpdated={handleConfigUpdated}
          />
          <ModelConfig
            modelType="embedding"
            config={configMap.embedding}
            onUpdated={handleConfigUpdated}
          />
          <ModelConfig
            modelType="rerank"
            config={configMap.rerank}
            onUpdated={handleConfigUpdated}
          />
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
