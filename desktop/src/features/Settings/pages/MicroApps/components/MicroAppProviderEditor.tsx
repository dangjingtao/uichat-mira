import { Save } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import { Select } from "@/shared/ui/Select";
import { TextInput } from "@/shared/ui/Input";

interface MicroAppProviderEditorProps {
  providers: Array<{ id: string; displayName: string }>;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  saving?: boolean;
  onProviderChange: (providerId: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelIdChange: (value: string) => void;
  onSave?: () => void;
  showSave?: boolean;
}

export default function MicroAppProviderEditor({
  providers,
  providerId,
  baseUrl,
  apiKey,
  modelId,
  saving,
  onProviderChange,
  onBaseUrlChange,
  onApiKeyChange,
  onModelIdChange,
  onSave,
  showSave = true,
}: MicroAppProviderEditorProps) {
  return (
    <div className="space-y-3 border-t border-border pt-3">
      <Select
        label="服务商"
        value={providerId}
        onChange={onProviderChange}
        options={[
          { value: "", label: "选择服务商" },
          ...providers.map((provider) => ({
            value: provider.id,
            label: provider.displayName,
          })),
        ]}
      />
      <TextInput label="服务地址" value={baseUrl} onChange={onBaseUrlChange} />
      <TextInput
        label="API 密钥"
        type="password"
        value={apiKey}
        onChange={onApiKeyChange}
        placeholder="输入 API 密钥"
      />
      <TextInput
        label="模型"
        value={modelId}
        onChange={onModelIdChange}
        placeholder="输入模型 ID，不依赖模型同步"
      />
      {showSave ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={onSave}
            disabled={saving || !providerId || !baseUrl.trim() || !modelId.trim()}
          >
            <Save className="h-4 w-4" />
            {saving ? "保存中..." : "保存配置"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
