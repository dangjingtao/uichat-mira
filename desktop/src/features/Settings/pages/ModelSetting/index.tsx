import DefaultModelCard from "../../components/DefaultModelCard";
import Header from "../../components/Header";
import { Button } from "@/shared/ui/Button";
import { Settings2 } from "lucide-react";
import { useRef, useState } from "react";

export default function ModelSettings() {
  const childRef = useRef<{ openPlatformSettings: () => void }>(null);

  const [ready, setReady] = useState(false);

  const handleClick = () => {
    if (!ready) return;
    childRef.current?.openPlatformSettings();
  };

  return (
    <div className="mx-auto flex w-full  flex-col gap-6 px-4 pb-6">
      <Header
        miniTitle="Model Settings"
        title="模型设置"
        description="在此页面中，您可以选择和配置用于问答的语言模型。平台侧负责连接与模型同步，这里只展示当前生效的角色配置，并允许直接保存调用参数。"
        slot={
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClick}
            className="gap-2 self-start"
          >
            <Settings2 className="h-4 w-4" />
            打开平台配置
          </Button>
        }
      />
      <DefaultModelCard onReady={() => setReady(true)} ref={childRef} />
    </div>
  );
}
