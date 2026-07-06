import React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Loader2, RotateCcw } from "lucide-react";
import { Button, IconButton } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { TextInput } from "@/shared/ui/Input";
import { Select } from "@/shared/ui/Select";
import type { ProviderDetail, RoleModelType } from "@/shared/api/modelSettings";
import {
  MODEL_ROLE_GROUPS,
  PROVIDER_CAPABILITY_GROUPS,
  providerSupportsCapability,
} from "../pages/ModelSetting/roleMeta";

interface ApiConfigCardProps {
  detail: ProviderDetail | null;
  selectedModelId: string;
  loading?: boolean;
  syncing?: boolean;
  assigningRole?: RoleModelType | null;
  syncError?: string | null;
  onDisplayNameChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onApiUrlChange: (value: string) => void;
  onSelectedModelChange: (value: string) => void;
  onTestConnection: () => void;
  onSetDefaultRole: (role: RoleModelType) => void;
}

const sectionClassName =
  "rounded-xl border border-border bg-surface-primary/80 p-3";

const ApiConfigCard: React.FC<ApiConfigCardProps> = ({
  detail,
  selectedModelId,
  loading = false,
  syncing = false,
  assigningRole = null,
  syncError = null,
  onDisplayNameChange,
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
            label: syncError
              ? t("settings.model.api.fetchFailed")
              : t("settings.model.api.noModels"),
          },
        ];

  const isBusy = loading || syncing;
  const providerKindKey = detail.provider.isSystem
    ? "settings.model.connections.builtinBadge"
    : "settings.model.connections.customBadge";

  return (
    <Card className="flex h-full flex-1 flex-col overflow-hidden" padding="sm">
      <div className="mb-3 flex items-start justify-between gap-2.5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-text-primary">
              {detail.provider.displayName}
            </div>
            <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[11px] font-medium text-text-secondary">
              {t(providerKindKey)}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {detail.provider.templateCode}
            </span>
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
        className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 ${
          loading ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <section className={sectionClassName}>
          <div className="mb-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              {t("settings.model.connections.sectionTitle")}
            </div>
            <div className="mt-1 text-xs leading-5 text-text-secondary">
              {t("settings.model.connections.sectionDescription")}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <TextInput
              label={t("settings.model.api.displayName")}
              value={detail.provider.displayName}
              onChange={onDisplayNameChange}
              placeholder={t("settings.model.api.displayNamePlaceholder")}
              compact
            />
            <TextInput
              label={t("settings.model.api.connectionId")}
              value={detail.provider.id}
              onChange={() => void 0}
              compact
              disabled
            />
            <TextInput
              label={t("settings.model.api.apiUrl")}
              value={detail.provider.baseUrl}
              onChange={onApiUrlChange}
              placeholder={t("settings.model.api.apiUrlPlaceholder")}
              compact
            />
            <TextInput
              label={t("settings.model.api.apiKey")}
              type="password"
              value={detail.provider.apiKey}
              onChange={onApiKeyChange}
              placeholder={t("settings.model.api.apiKeyPlaceholder")}
              compact
            />
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="mb-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              {t("settings.model.capabilities.sectionTitle")}
            </div>
            <div className="mt-1 text-xs leading-5 text-text-secondary">
              {t("settings.model.capabilities.sectionDescription")}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {PROVIDER_CAPABILITY_GROUPS.map((capability) => {
              const supported = providerSupportsCapability(
                detail.provider,
                capability.id,
              );

              return (
                <span
                  key={capability.id}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    supported
                      ? "bg-success/10 text-success"
                      : "bg-surface-secondary text-text-tertiary"
                  }`}
                >
                  {t(capability.labelKey)}
                </span>
              );
            })}
          </div>
        </section>

        <section className={sectionClassName}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                {t("settings.model.api.syncedModelsTitle")}
              </div>
              <div className="mt-1 text-xs leading-5 text-text-secondary">
                {t("settings.model.api.syncedModelsDescription")}
              </div>
            </div>

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

          <Select
            label={t("settings.model.api.currentModel")}
            value={selectedModelId}
            onChange={onSelectedModelChange}
            options={modelOptions}
            compact
            error={syncError ?? undefined}
          />

          <div className="mt-2 text-xs text-text-secondary">
            {detail.provider.lastSyncedAt
              ? t("settings.model.api.lastSyncedAt", {
                  value: detail.provider.lastSyncedAt,
                })
              : t("settings.model.api.neverSynced")}
          </div>
        </section>

        {detail.provider.lastError ? (
          <div className="flex items-start gap-2 rounded-ui-panel border border-danger-border bg-danger-soft px-3 py-2 text-xs text-danger-text">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{detail.provider.lastError}</span>
          </div>
        ) : null}

        <section className={sectionClassName}>
          <div className="mb-2">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
              {t("settings.model.api.roleBindingsTitle")}
            </div>
            <div className="mt-1 text-xs leading-5 text-text-secondary">
              {t("settings.model.api.roleBindingsDescription")}
            </div>
          </div>

          <div className="space-y-3">
            {MODEL_ROLE_GROUPS.map((group) => (
              <div key={group.id} className="rounded-lg bg-surface-secondary/50 p-2.5">
                <div className="mb-2 flex flex-col gap-0.5">
                  <div className="text-sm font-medium text-text-primary">
                    {t(group.titleKey)}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {t(group.descriptionKey)}
                  </div>
                </div>

                <div className="mb-2 flex flex-wrap gap-1.5">
                  {group.roles.map((item) => (
                    <Button
                      key={item.role}
                      size="small"
                      variant="secondary"
                      onClick={() => onSetDefaultRole(item.role)}
                      disabled={assigningRole === item.role || !selectedModelId}
                    >
                      {assigningRole === item.role
                        ? t("settings.model.api.setting")
                        : t(item.actionLabelKey)}
                    </Button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  {group.roles.map((item) => {
                    const assignment = detail.assignments[item.role];
                    const summary = assignment
                      ? `${assignment.providerCode} · ${assignment.modelName}`
                      : t("settings.model.api.unassigned");

                    return (
                      <div
                        key={`${group.id}:${item.role}:summary`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface-primary px-2.5 py-2 text-xs"
                      >
                        <span className="font-medium text-text-primary">
                          {t(`settings.model.config.${item.role}.title`)}
                        </span>
                        <span className="text-text-secondary">{summary}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Card>
  );
};

export default ApiConfigCard;
