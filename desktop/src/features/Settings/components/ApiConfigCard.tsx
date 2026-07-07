import React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { Button, IconButton } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { TextInput } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";
import type { ProviderDetail, RoleModelType } from "@/shared/api/modelSettings";

const ASSIGNABLE_ROLES: Array<{
  role: RoleModelType;
  labelKey: string;
}> = [
  { role: "llm", labelKey: "settings.model.api.setDefaultLlm" },
  { role: "embedding", labelKey: "settings.model.api.setDefaultEmbedding" },
  { role: "rerank", labelKey: "settings.model.api.setDefaultRerank" },
  { role: "task", labelKey: "settings.model.api.setDefaultTask" },
  { role: "agentTask", labelKey: "settings.model.api.setDefaultAgentTask" },
  {
    role: "imageGeneration",
    labelKey: "settings.model.api.setDefaultImageGeneration",
  },
  {
    role: "evaluation",
    labelKey: "settings.model.api.setDefaultEvaluation",
  },
];

interface ApiConfigCardProps {
  detail: ProviderDetail | null;
  selectedModelId: string;
  loading?: boolean;
  syncing?: boolean;
  hideRoleActions?: boolean;
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
  hideRoleActions = false,
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
      <Card className="flex h-full flex-1 items-center justify-center text-sm text-text-secondary">
        {t("settings.model.api.selectPlatform")}
      </Card>
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
            label: syncError ? "fetch failed" : t("settings.model.api.noModels"),
          },
        ];

  const isBusy = loading || syncing;

  return (
    <Card className="flex h-full flex-1 flex-col" padding="sm">
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
              size="sm"
              styleType="outline"
              onClick={onTestConnection}
              disabled={isBusy}
            >
              <RotateCcw className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        {detail.provider.lastError ? (
          <div className="flex items-start gap-2 rounded-ui-panel border border-danger-border bg-danger-soft px-3 py-2 text-xs text-danger-text">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{detail.provider.lastError}</span>
          </div>
        ) : null}

        {!hideRoleActions ? (
          <div className="flex flex-wrap gap-1.5">
            {ASSIGNABLE_ROLES.map(({ role, labelKey }) => (
              <Button
                key={role}
                size="small"
                variant="secondary"
                onClick={() => onSetDefaultRole(role)}
                disabled={assigningRole === role || !selectedModelId}
              >
                {assigningRole === role
                  ? t("settings.model.api.setting")
                  : t(labelKey)}
              </Button>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
};

export default ApiConfigCard;
