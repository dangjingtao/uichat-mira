import React from "react";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { Button, IconButton } from "@/shared/ui/Button";
import { TextInput } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";
import type {
  ProviderDetail,
  RoleModelType,
} from "@/shared/api/modelSettings";

interface ApiConfigCardProps {
  detail: ProviderDetail | null;
  selectedModelId: string;
  loading?: boolean;
  syncing?: boolean;
  assigningRole?: RoleModelType | null;
  syncError?: string | null;
  onApiKeyChange: (value: string) => void;
  onApiUrlChange: (value: string) => void;
  onSelectedModelChange: (value: string) => void;
  onTestConnection: () => void;
  onSetDefaultRole: (role: RoleModelType) => void;
}

const statusLabelMap = {
  idle: "待连接",
  syncing: "同步中",
  connected: "已连接",
  error: "异常",
} as const;

const ApiConfigCard: React.FC<ApiConfigCardProps> = ({
  detail,
  selectedModelId,
  loading = false,
  syncing = false,
  assigningRole = null,
  syncError = null,
  onApiKeyChange,
  onApiUrlChange,
  onSelectedModelChange,
  onTestConnection,
  onSetDefaultRole,
}) => {
  if (!detail) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-2xl border border-border bg-surface-primary p-4 text-sm text-text-secondary">
        请选择左侧平台。
      </div>
    );
  }

  const modelOptions =
    detail.models.length > 0
      ? [
          { value: "", label: "选择模型..." },
          ...detail.models.map((model) => ({
            value: model.id,
            label: model.name,
          })),
        ]
      : [
          {
            value: "",
            label: syncError ? "fetch failed" : "暂无模型，请先同步",
          },
        ];

  const isBusy = loading || syncing;

  return (
    <div className="flex h-full flex-1 flex-col rounded-2xl border border-border bg-surface-primary p-3 shadow-shadow-sm">
      <div className="mb-2.5 flex items-start justify-between gap-2.5">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold text-text-primary">
            {detail.provider.displayName}
          </div>
          <div className="text-xs leading-4 text-text-secondary">
            保存连接配置后，通过服务端同步模型列表；同步成功即代表平台链路可用。
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-1 text-xs text-text-secondary">
          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {statusLabelMap[detail.provider.status]}
        </div>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col space-y-2.5 ${
          loading ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <TextInput
          label="API 密钥"
          type="password"
          value={detail.provider.apiKey}
          onChange={onApiKeyChange}
          placeholder="输入 API 密钥"
          compact
        />

        <div className="grid grid-cols-1 gap-1.5">
          <TextInput
            label="API 地址"
            value={detail.provider.baseUrl}
            onChange={onApiUrlChange}
            placeholder="输入 API 地址"
            compact
          />
          <p className="text-xs leading-4 text-text-secondary">
            预览请求地址：{detail.provider.baseUrl}/api/chat
          </p>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <div className="w-full max-w-[600px]">
            <Select
              label="当前模型"
              value={selectedModelId}
              onChange={onSelectedModelChange}
              options={modelOptions}
              compact
              error={syncError ?? undefined}
            />
          </div>
          <div className="flex items-end">
            <IconButton
              ariaLabel="保存配置并同步模型"
              className="h-8 w-8"
              onClick={onTestConnection}
              disabled={isBusy}
            >
              <RotateCcw className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        {detail.provider.lastError ? (
          <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-xs text-danger">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{detail.provider.lastError}</span>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="small"
            variant="secondary"
            onClick={() => onSetDefaultRole("llm")}
            disabled={assigningRole === "llm" || !selectedModelId}
          >
            {assigningRole === "llm" ? "设置中..." : "设为默认 LLM"}
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => onSetDefaultRole("embedding")}
            disabled={assigningRole === "embedding" || !selectedModelId}
          >
            {assigningRole === "embedding" ? "设置中..." : "设为默认 Embedding"}
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => onSetDefaultRole("rerank")}
            disabled={assigningRole === "rerank" || !selectedModelId}
          >
            {assigningRole === "rerank" ? "设置中..." : "设为默认 ReRank"}
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => onSetDefaultRole("task")}
            disabled={assigningRole === "task" || !selectedModelId}
          >
            {assigningRole === "task" ? "设置中..." : "设为默认 Task"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ApiConfigCard;
