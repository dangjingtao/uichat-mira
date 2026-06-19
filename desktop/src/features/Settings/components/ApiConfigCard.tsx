import React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { Button, IconButton } from "@/shared/ui/Button";
import { TextInput } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";
import type { ProviderDetail, RoleModelType } from "@/shared/api/modelSettings";

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
  const { t } = useTranslation();

  if (!detail) {
    return (
      <div className="flex h-full flex-1 items-center justify-center rounded-2xl border border-border bg-surface-primary p-4 text-sm text-text-secondary">
        {t("settings.model.api.selectPlatform")}
      </div>
    );
  }

  const modelOptions =
    detail.models.length > 0
      ? [
          { value: "", label: t("settings.model.api.selectModel") },
          ...detail.models.map((model) => ({
            value: model.id,
            label: model.name,
          })),
        ]
      : [
          {
            value: "",
            label: syncError
              ? "fetch failed"
              : t("settings.model.api.noModels"),
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
            {t("settings.model.api.description")}
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-1 text-xs text-text-secondary">
          {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t(`settings.model.status.${detail.provider.status}`)}
        </div>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col space-y-2.5 ${
          loading ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <TextInput
          label={t("settings.model.api.apiKey")}
          type="password"
          value={detail.provider.apiKey}
          onChange={onApiKeyChange}
          placeholder={t("settings.model.api.apiKeyPlaceholder")}
          compact
        />

        <div className="grid grid-cols-1 gap-1.5">
          <TextInput
            label={t("settings.model.api.apiUrl")}
            value={detail.provider.baseUrl}
            onChange={onApiUrlChange}
            placeholder={t("settings.model.api.apiUrlPlaceholder")}
            compact
          />
        </div>

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Select
              label={t("settings.model.api.currentModel")}
              value={selectedModelId}
              onChange={onSelectedModelChange}
              options={modelOptions}
              compact
              error={syncError ?? undefined}
            />
          </div>
          <div className="shrink-0 pt-6">
            <IconButton
              ariaLabel={t("settings.model.api.syncAriaLabel")}
              className="h-8 w-8 rounded-md border border-border bg-surface-primary hover:bg-surface-secondary"
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
            {assigningRole === "llm"
              ? t("settings.model.api.setting")
              : t("settings.model.api.setDefaultLlm")}
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => onSetDefaultRole("embedding")}
            disabled={assigningRole === "embedding" || !selectedModelId}
          >
            {assigningRole === "embedding"
              ? t("settings.model.api.setting")
              : t("settings.model.api.setDefaultEmbedding")}
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => onSetDefaultRole("rerank")}
            disabled={assigningRole === "rerank" || !selectedModelId}
          >
            {assigningRole === "rerank"
              ? t("settings.model.api.setting")
              : t("settings.model.api.setDefaultRerank")}
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => onSetDefaultRole("task")}
            disabled={assigningRole === "task" || !selectedModelId}
          >
            {assigningRole === "task"
              ? t("settings.model.api.setting")
              : t("settings.model.api.setDefaultTask")}
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => onSetDefaultRole("evaluation")}
            disabled={assigningRole === "evaluation" || !selectedModelId}
          >
            {assigningRole === "evaluation"
              ? t("settings.model.api.setting")
              : t("settings.model.api.setDefaultEvaluation")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ApiConfigCard;
