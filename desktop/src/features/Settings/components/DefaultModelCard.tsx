import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Layers3, Settings2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { forwardRef, useImperativeHandle } from "react";
import { Modal } from "@/shared/ui/Modal";
import { message } from "@/shared/ui/Message";
import {
  getRoleModelConfigs,
  type RoleModelConfig,
} from "@/shared/api/modelSettings";
import ModelConfig from "./ModelConfig";
import PlatformConfigModal from "./PlatformConfigModal";

interface DefaultModelCardProps {
  onReady?: () => void;
}

interface DefaultModelCardRef {
  openPlatformSettings: () => void;
}

const DefaultModelCard = forwardRef<DefaultModelCardRef, DefaultModelCardProps>(
  ({ onReady }, ref) => {
    const [configs, setConfigs] = useState<RoleModelConfig[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      if (onReady) {
        onReady();
      }
    }, []);

    const loadConfigs = useCallback(async () => {
      try {
        setLoading(true);
        const nextConfigs = await getRoleModelConfigs();
        setConfigs(nextConfigs);
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : "加载模型配置失败";
        message.error(messageText);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => {
      void loadConfigs();
    }, [loadConfigs]);

    const configMap = useMemo(() => {
      return {
        llm: configs.find((item) => item.type === "llm") ?? null,
        task: configs.find((item) => item.type === "task") ?? null,
        embedding: configs.find((item) => item.type === "embedding") ?? null,
        rerank: configs.find((item) => item.type === "rerank") ?? null,
      };
    }, [configs]);

    const handleConfigUpdated = (updated: RoleModelConfig) => {
      setConfigs((prev) =>
        prev.map((item) => (item.type === updated.type ? updated : item)),
      );
    };

    const openPlatformSettings = () => {
      let modalKey = "";

      modalKey = Modal.show({
        title: "平台模型设置",
        width: 940,
        height: 560,
        onClose: () => {
          void loadConfigs();
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
        content: <PlatformConfigModal onRoleConfigUpdated={loadConfigs} />,
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
