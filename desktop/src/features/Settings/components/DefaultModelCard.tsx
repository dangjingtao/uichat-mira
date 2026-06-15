import React, { useEffect } from "react";
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
        title: "平台模型设置",
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
              关闭
            </Button>
            <Button size="sm" onClick={() => Modal.close(modalKey)}>
              完成
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
      <div>
        <div className="space-y-3">
          <div className="space-y-2.5">
            <ModelConfig
              modelType="llm"
              config={configMap.llm}
              onUpdated={handleConfigUpdated}
            />
            <ModelConfig
              modelType="task"
              config={configMap.task}
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
              正在同步模型配置...
            </div>
          ) : null}
        </div>
      </div>
    );
  },
);

export default DefaultModelCard;
