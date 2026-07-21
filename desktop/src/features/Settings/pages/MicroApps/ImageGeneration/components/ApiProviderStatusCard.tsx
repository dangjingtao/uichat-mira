import { ImageIcon } from "lucide-react";
import Card from "@/shared/ui/Card";
import MicroAppProviderEditor from "../../components/MicroAppProviderEditor";

export interface ApiImageProviderSummary {
  providerConnectionId: string;
  providerDisplayName: string;
  providerCode: string | null;
  providerTemplateCode: string | null;
  baseUrl: string;
  modelId: string;
  status: "idle" | "syncing" | "connected" | "error";
  hasApiKey: boolean;
}

export type ApiImageSizeOption = {
  value: string;
  label: string;
};

interface ApiProviderStatusCardProps {
  provider: ApiImageProviderSummary | null;
  loading: boolean;
  providers: Array<{ id: string; displayName: string }>;
  draft: {
    providerId: string;
    baseUrl: string;
    apiKey: string;
    modelId: string;
  };
  saving: boolean;
  onDraftChange: (patch: Partial<ApiProviderStatusCardProps["draft"]>) => void;
  onSave: () => void;
}

export default function ApiProviderStatusCard({
  provider,
  loading,
  providers,
  draft,
  saving,
  onDraftChange,
  onSave,
}: ApiProviderStatusCardProps) {
  return (
    <Card className="space-y-4">
      <div className="text-sm font-semibold text-text-primary">当前生图模型</div>

      {!provider ? (
        <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-6 text-center">
          <ImageIcon className="h-8 w-8 text-icon-secondary" />
          <div className="text-sm font-medium text-text-primary">
            还没有配置默认生图模型
          </div>
          <div className="text-sm leading-6 text-text-secondary">
            先到模型设置里把默认生图模型绑定到 OpenAI 或火山可用连接，再回来直接出图。
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between gap-3 px-4 py-1">
            <div className="min-w-0 py-3">
              <div className="truncate text-sm font-medium text-text-primary">
                {provider.providerDisplayName}
              </div>
              <div className="mt-1 text-xs text-text-secondary">
                {provider.providerCode ?? provider.providerTemplateCode ?? "custom"}
              </div>
            </div>
            <div className="py-3 text-xs text-text-tertiary">
              {loading ? "读取中..." : provider.hasApiKey ? "已配置密钥" : "缺少密钥"}
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-xs text-text-tertiary">模型</div>
            <div className="mt-1 break-all text-sm font-medium text-text-primary">
              {provider.modelId}
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="text-xs text-text-tertiary">地址</div>
            <div className="mt-1 break-all text-sm text-text-primary">
              {provider.baseUrl}
            </div>
          </div>
        </div>
      )}
      <MicroAppProviderEditor
        providers={providers}
        providerId={draft.providerId}
        baseUrl={draft.baseUrl}
        apiKey={draft.apiKey}
        modelId={draft.modelId}
        saving={saving}
        onProviderChange={(providerId) => onDraftChange({ providerId })}
        onBaseUrlChange={(baseUrl) => onDraftChange({ baseUrl })}
        onApiKeyChange={(apiKey) => onDraftChange({ apiKey })}
        onModelIdChange={(modelId) => onDraftChange({ modelId })}
        onSave={onSave}
      />
    </Card>
  );
}
