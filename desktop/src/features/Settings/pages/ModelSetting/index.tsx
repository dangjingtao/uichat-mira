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
  const childRef = useRef<{ openPlatformSettings: () => void }>(null);
  const { refresh } = useRoleModelConfigs();
  const [ready, setReady] = useState(false);

  const handleClick = () => {
    if (!ready) return;
    childRef.current?.openPlatformSettings();
  };

  const handleResetAllDefaults = async () => {
    const modalKey = Modal.show({
      title: "确认重置默认模型",
      width: 460,
      content: (
        <div className="space-y-3 text-sm text-text-secondary">
          <p>将清空 LLM、Embedding、Rerank、Task 四个默认模型，并恢复默认参数。</p>
          <div className="rounded-xl border border-danger/20 bg-danger/5 px-3.5 py-3 text-danger">
            该操作会影响当前对话与知识库的默认模型选择。
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
            onClick={async () => {
              try {
                Modal.close(modalKey);
                await Promise.all([
                  resetProviderRoleModel("llm"),
                  resetProviderRoleModel("embedding"),
                  resetProviderRoleModel("rerank"),
                  resetProviderRoleModel("task"),
                ]);
                await refresh();
                message.success("默认模型已重置");
              } catch (error) {
                message.error(error instanceof Error ? error.message : "重置失败");
              }
            }}
          >
            确认重置
          </Button>
        </>
      ),
    });
  };

  return (
    <SettingsPageLayout
        miniTitle="Model Settings"
        title="模型设置"
        description="在此页面中，您可以选择和配置用于问答的语言模型。平台侧负责连接与模型同步，这里只展示当前生效的角色配置，并允许直接保存调用参数。"
        slot={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetAllDefaults}
              className="gap-2 self-start"
            >
              <RotateCcw className="h-4 w-4" />
              重置默认模型
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClick}
              className="gap-2 self-start"
            >
              <Settings2 className="h-4 w-4" />
              模型设置
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
