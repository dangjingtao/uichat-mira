import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/Button";
import { NumberInput } from "@/shared/ui/Input";
import { message } from "@/shared/ui/Message";
import { Select } from "@/shared/ui/Select";
import {
  type RoleModelConfig,
  type RoleModelType,
  updateRoleModelConfigParams,
} from "@/shared/api/modelSettings";
import { getProviderLabel } from "@/shared/providerCatalog";
import SettingsNotice from "./SettingsNotice";
import SettingsStatBlock from "./SettingsStatBlock";

interface ParamMeta {
  key: string;
  label: string;
  type: "number" | "select";
  step?: number;
  options?: { value: string; label: string }[];
}

interface ModelMeta {
  titleKey: string;
  subtitleKey: string;
  badgeText: string;
  badgeClassName: string;
  params: ParamMeta[];
}

type ConfigValue = number | string | boolean;
type ConfigState = Record<string, ConfigValue>;

const MODEL_META: Record<RoleModelType, ModelMeta> = {
  llm: {
    titleKey: "settings.model.config.llm.title",
    subtitleKey: "settings.model.config.llm.subtitle",
    badgeText: "LM",
    badgeClassName: "bg-primary/10 text-primary",
    params: [
      { key: "temperature", label: "Temperature", type: "number", step: 0.1 },
      { key: "topP", label: "Top P", type: "number", step: 0.1 },
      { key: "topK", label: "Top K", type: "number" },
      { key: "maxTokens", label: "Max Tokens", type: "number" },
      {
        key: "frequencyPenalty",
        label: "Frequency Penalty",
        type: "number",
        step: 0.1,
      },
      {
        key: "presencePenalty",
        label: "Presence Penalty",
        type: "number",
        step: 0.1,
      },
    ],
  },
  task: {
    titleKey: "settings.model.config.task.title",
    subtitleKey: "settings.model.config.task.subtitle",
    badgeText: "TSK",
    badgeClassName: "bg-warning/10 text-warning",
    params: [
      { key: "temperature", label: "Temperature", type: "number", step: 0.1 },
      { key: "topP", label: "Top P", type: "number", step: 0.1 },
      { key: "topK", label: "Top K", type: "number" },
      { key: "maxTokens", label: "Max Tokens", type: "number" },
      {
        key: "frequencyPenalty",
        label: "Frequency Penalty",
        type: "number",
        step: 0.1,
      },
      {
        key: "presencePenalty",
        label: "Presence Penalty",
        type: "number",
        step: 0.1,
      },
    ],
  },
  evaluation: {
    titleKey: "settings.model.config.evaluation.title",
    subtitleKey: "settings.model.config.evaluation.subtitle",
    badgeText: "EVA",
    badgeClassName: "bg-primary/10 text-primary",
    params: [
      { key: "temperature", label: "Temperature", type: "number", step: 0.1 },
      { key: "topP", label: "Top P", type: "number", step: 0.1 },
      { key: "topK", label: "Top K", type: "number" },
      { key: "maxTokens", label: "Max Tokens", type: "number" },
      {
        key: "frequencyPenalty",
        label: "Frequency Penalty",
        type: "number",
        step: 0.1,
      },
      {
        key: "presencePenalty",
        label: "Presence Penalty",
        type: "number",
        step: 0.1,
      },
    ],
  },
  embedding: {
    titleKey: "settings.model.config.embedding.title",
    subtitleKey: "settings.model.config.embedding.subtitle",
    badgeText: "EM",
    badgeClassName: "bg-success/10 text-success",
    params: [
      { key: "dimensions", label: "Dimensions", type: "number" },
      { key: "batchSize", label: "Batch Size", type: "number" },
      {
        key: "normalize",
        label: "Normalize",
        type: "select",
        options: [
          { value: "true", label: "True" },
          { value: "false", label: "False" },
        ],
      },
      { key: "chunkSize", label: "Chunk Size", type: "number" },
      { key: "chunkOverlap", label: "Chunk Overlap", type: "number" },
    ],
  },
  rerank: {
    titleKey: "settings.model.config.rerank.title",
    subtitleKey: "settings.model.config.rerank.subtitle",
    badgeText: "RE",
    badgeClassName: "bg-surface-tertiary text-text-secondary",
    params: [
      { key: "topN", label: "Top N", type: "number" },
      {
        key: "scoreThreshold",
        label: "Score Threshold",
        type: "number",
        step: 0.1,
      },
    ],
  },
};

const normalizeConfigState = (
  config: RoleModelConfig | null | undefined,
): ConfigState => {
  const params = (config?.params ?? {}) as Record<string, ConfigValue>;
  return {
    enabled: Boolean(config?.remoteModelId),
    ...params,
  };
};

interface ModelConfigProps {
  modelType: RoleModelType;
  config: RoleModelConfig | null;
  onUpdated: (config: RoleModelConfig) => void;
  readOnly?: boolean;
}

const ModelConfig: React.FC<ModelConfigProps> = ({
  modelType,
  config,
  onUpdated,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const meta = MODEL_META[modelType];
  const [localConfig, setLocalConfig] = useState<ConfigState>(
    normalizeConfigState(config),
  );
  const [isChanged, setIsChanged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalConfig(normalizeConfigState(config));
    setIsChanged(false);
  }, [config]);

  const isConfigured = Boolean(config?.providerCode && config?.remoteModelId);
  const providerLabel = config?.providerCode
    ? getProviderLabel(config.providerCode)
    : t("settings.model.config.notConfigured");

  const handleChange = (key: string, value: ConfigValue) => {
    if (readOnly) {
      return;
    }

    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setIsChanged(true);
  };

  const handleSave = async () => {
    if (!config) {
      return;
    }

    setIsSaving(true);
    try {
      const { enabled: _enabled, ...params } = localConfig;
      const updated = await updateRoleModelConfigParams(modelType, params);
      onUpdated(updated);
      message.success(t("settings.model.config.saved"));
      setIsChanged(false);
    } catch (err) {
      const messageText =
        err instanceof Error
          ? err.message
          : t("settings.model.config.saveFailed");
      message.error(messageText);
    } finally {
      setIsSaving(false);
    }
  };

  const fields = useMemo(() => meta.params, [meta.params]);

  return (
    <div
      className={`rounded-xl border border-border bg-surface-primary p-3 shadow-shadow-sm ${
        readOnly ? "opacity-70" : ""
      }`}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 items-start gap-2">
          <div
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-semibold ${meta.badgeClassName}`}
          >
            {meta.badgeText}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="text-sm font-semibold text-text-primary">
                {t(meta.titleKey)}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  isConfigured
                    ? "bg-success/10 text-success"
                    : "bg-surface-tertiary text-text-secondary"
                }`}
              >
                {isConfigured
                  ? t("settings.model.config.configured")
                  : t("settings.model.config.notConfigured")}
              </span>
            </div>
            <div className="text-xs leading-4 text-text-secondary">
              {t(meta.subtitleKey)}
            </div>
          </div>
        </div>

        {readOnly ? (
          <span className="rounded-full bg-surface-tertiary px-2 py-1 text-xs text-text-secondary">
            {t("settings.model.config.managed")}
          </span>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={!isConfigured || !isChanged || isSaving}
            onClick={handleSave}
          >
            {isSaving
              ? t("settings.model.config.saving")
              : t("settings.model.config.save")}
          </Button>
        )}
      </div>

      {readOnly ? (
        <SettingsNotice tone="info" size="sm" className="mb-2.5 leading-5">
          {t("settings.model.config.task.readOnlyHint")}
        </SettingsNotice>
      ) : null}

      <div className="mb-2.5">
        <SettingsStatBlock
          label={providerLabel}
          value={config?.name || t("settings.model.config.selectModel")}
          size="sm"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => {
          const value = localConfig[field.key];
          const isReadonlyDimensions =
            modelType === "embedding" && field.key === "dimensions";

          if (field.type === "select") {
            return (
              <Select
                key={field.key}
                label={field.label}
                value={
                  typeof value === "boolean"
                    ? value.toString()
                    : String(value ?? "")
                }
                onChange={(nextValue) =>
                  handleChange(
                    field.key,
                    field.key === "normalize"
                      ? nextValue === "true"
                      : nextValue,
                  )
                }
                options={field.options ?? []}
                compact
                disabled={!isConfigured || readOnly}
              />
            );
          }

          return (
            <NumberInput
              key={field.key}
              label={field.label}
              value={Number(value ?? 0)}
              onChange={(nextValue) => {
                if (isReadonlyDimensions) {
                  return;
                }

                handleChange(field.key, nextValue);
              }}
              step={field.step}
              compact
              disabled={!isConfigured || isReadonlyDimensions || readOnly}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ModelConfig;
