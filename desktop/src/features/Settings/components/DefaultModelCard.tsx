import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers3, Settings2 } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { Modal } from "@/shared/ui/Modal";
import { message } from "@/shared/ui/Message";
import {
  getRoleModelConfigs,
  type RoleModelConfig,
} from "@/shared/api/modelSettings";
import ModelConfig from "./ModelConfig";
import PlatformConfigModal from "./PlatformConfigModal";

const DefaultModelCard: React.FC = () => {
  const [configs, setConfigs] = useState<RoleModelConfig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const nextConfigs = await getRoleModelConfigs();
      setConfigs(nextConfigs);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "加载模型配置失败";
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
          <Button variant="ghost" size="sm" onClick={() => Modal.close(modalKey)}>
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

  return (
    <Card className="p-3.5">
      <div className="space-y-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers3 className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-0.5">
              <div className="text-sm font-semibold text-text-primary">
                默认模型配置
              </div>
              <div className="max-w-2xl text-xs leading-4 text-text-secondary">
                平台侧负责连接与模型同步，这里只展示当前生效的角色配置，并允许直接保存调用参数。
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={openPlatformSettings}
            className="gap-2 self-start"
          >
            <Settings2 className="h-4 w-4" />
            打开平台配置
          </Button>
        </div>

        <div className="space-y-2.5">
          <ModelConfig
            modelType="llm"
            config={configMap.llm}
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
          <div className="text-xs text-text-secondary">正在同步模型配置...</div>
        ) : null}
      </div>
    </Card>
  );
};

export default DefaultModelCard;
