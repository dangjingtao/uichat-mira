import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/Button";
import { NumberInput } from "@/shared/ui/Input";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import { Select } from "@/shared/ui/Select";
import {
  type RoleModelConfig,
  type RoleModelType,
  updateRoleModelConfigParams,
} from "@/shared/api/modelSettings";
import { getBuiltInLocalModel } from "@/shared/business/localModels";
import { hasConfiguredProviderBinding } from "@/shared/business/modelAccess";
import { getProviderLabel } from "@/shared/providerCatalog";
import PlatformConfigModal, {
  type PlatformConfigModalRef,
} from "./PlatformConfigModal";
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
  readOnlyHintKey?: string;
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
    readOnlyHintKey: "settings.model.config.task.readOnlyHint",
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
  agentTask: {
    titleKey: "settings.model.config.agentTask.title",
    subtitleKey: "settings.model.config.agentTask.subtitle",
    badgeText: "AGT",
    badgeClassName: "bg-warning/10 text-warning",
    readOnlyHintKey: "settings.model.config.agentTask.readOnlyHint",
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
  imageGeneration: {
    titleKey: "settings.model.config.imageGeneration.title",
    subtitleKey: "settings.model.config.imageGeneration.subtitle",
    badgeText: "IMG",
    badgeClassName: "bg-primary/10 text-primary",
    readOnlyHintKey: "settings.model.config.imageGeneration.readOnlyHint",
    params: [],
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

function buildModelSummary(
  t: (key: string, options?: Record<string, unknown>) => string,
  config: RoleModelConfig | null,
  modelType: RoleModelType,
) {
  const builtInModel = getBuiltInLocalModel(modelType);
  const isConfigured = hasConfiguredProviderBinding(config);
  const providerLabel = config?.providerCode
    ? getProviderLabel(config.providerCode)
    : config?.providerConnectionDisplayName
      ? config.providerConnectionDisplayName
      : config?.providerConnectionId
        ? config.providerConnectionId
      : builtInModel
        ? t("settings.model.config.builtInLocal")
        : t("settings.model.config.notConfigured");
  const providerDescription = config?.providerTemplateCode
    ? t("settings.model.config.providerTemplate", {
        template: config.providerTemplateCode,
      })
    : builtInModel
      ? builtInModel.runtime
      : undefined;
  const modelLabel = isConfigured
    ? config?.name || t("settings.model.config.selectModel")
    : builtInModel
      ? builtInModel.displayName
      : t("settings.model.config.selectModel");
  const modelDescription =
    !isConfigured && builtInModel
      ? [
          builtInModel.runtime,
          builtInModel.dimensions
            ? t("settings.model.config.dimensions", {
                count: builtInModel.dimensions,
              })
            : null,
          builtInModel.optional
            ? t("settings.model.config.optionalBuiltIn")
            : t("settings.model.config.defaultBuiltIn"),
        ]
          .filter(Boolean)
          .join(" · ")
      : undefined;
  const builtInModelDescription = builtInModel
    ? [
        builtInModel.optional
          ? t("settings.model.config.optionalBuiltIn")
          : t("settings.model.config.defaultBuiltIn"),
        builtInModel.displayName,
        builtInModel.runtime,
        builtInModel.dimensions
          ? t("settings.model.config.dimensions", {
              count: builtInModel.dimensions,
            })
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  return {
    builtInModel,
    builtInModelDescription,
    isConfigured,
    modelLabel,
    modelDescription,
    providerDescription,
    providerLabel,
  };
}

function buildStatusMeta(
  t: (key: string, options?: Record<string, unknown>) => string,
  isConfigured: boolean,
  builtInModel: ReturnType<typeof getBuiltInLocalModel>,
) {
  if (isConfigured) {
    return {
      label: t("settings.model.config.configured"),
      dotClassName: "bg-success",
    };
  }

  if (builtInModel) {
    return {
      label: builtInModel.optional
        ? t("settings.model.config.optionalBuiltIn")
        : t("settings.model.config.builtInReady"),
      dotClassName: "bg-success",
    };
  }

  return {
    label: t("settings.model.config.notConfigured"),
    dotClassName: "bg-danger",
  };
}

interface ModelConfigProps {
  modelType: RoleModelType;
  config: RoleModelConfig | null;
  onUpdated: (config: RoleModelConfig) => void;
  readOnly?: boolean;
}

interface ModelConfigEditorProps extends ModelConfigProps {
  onClose: () => void;
}

interface ModelSelectorDialogContentProps {
  modelType: RoleModelType;
  onClose: () => void;
}

const ModelConfigEditor: React.FC<ModelConfigEditorProps> = ({
  modelType,
  config,
  onUpdated,
  onClose,
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

  const {
    builtInModel,
    builtInModelDescription,
    isConfigured,
    modelLabel,
    modelDescription,
    providerDescription,
    providerLabel,
  } = buildModelSummary(t, config, modelType);

  const handleChange = (key: string, value: ConfigValue) => {
    if (readOnly) {
      return;
    }

    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setIsChanged(true);
  };

  const handleSave = async () => {
    if (!config || readOnly) {
      return;
    }

    setIsSaving(true);
    try {
      const { enabled: _enabled, ...params } = localConfig;
      const updated = await updateRoleModelConfigParams(modelType, params);
      onUpdated(updated);
      setLocalConfig(normalizeConfigState(updated));
      setIsChanged(false);
      message.success(t("settings.model.config.saved"));
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
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="text-sm font-medium text-text-primary">
          {t(meta.subtitleKey)}
        </div>
        <div className="text-xs leading-5 text-text-secondary">
          {readOnly
            ? t("settings.model.config.viewInDialogHint")
            : t("settings.model.config.editInDialogHint")}
        </div>
      </div>

      {readOnly ? (
        <SettingsNotice tone="info" size="sm" className="leading-5">
          {t(meta.readOnlyHintKey ?? "settings.model.config.task.readOnlyHint")}
        </SettingsNotice>
      ) : null}

      <SettingsStatBlock
        label={t("settings.model.config.connectionLabel", {
          provider: providerLabel,
        })}
        value={modelLabel}
        description={modelDescription ?? providerDescription}
        size="sm"
      />

      {builtInModelDescription ? (
        <div className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 text-xs leading-5 text-text-secondary">
          {builtInModelDescription}
        </div>
      ) : null}

      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface-secondary/40 px-3 py-2 text-xs leading-5 text-text-secondary">
          {t("settings.model.config.noEditableParams")}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
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
      )}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("common.actions.close")}
        </Button>
        {!readOnly ? (
          <Button
            size="sm"
            disabled={!isConfigured || !isChanged || isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving
              ? t("settings.model.config.saving")
              : t("settings.model.config.save")}
          </Button>
        ) : null}
      </div>
    </div>
  );
};

const ModelSelectorDialogContent: React.FC<ModelSelectorDialogContentProps> = ({
  modelType,
  onClose,
}) => {
  const { t } = useTranslation();
  const meta = MODEL_META[modelType];
  const selectorRef = useRef<PlatformConfigModalRef | null>(null);
  const [selectorState, setSelectorState] = useState({
    canConfirm: false,
    confirming: false,
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <PlatformConfigModal
          ref={selectorRef}
          selectionRole={modelType}
          onSelectionStateChange={setSelectorState}
        />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t("settings.model.defaultCard.close")}
        </Button>
        <Button
          size="sm"
          disabled={!selectorState.canConfirm || selectorState.confirming}
          onClick={async () => {
            const confirmed = await selectorRef.current?.confirmSelection();
            if (confirmed) {
              onClose();
            }
          }}
        >
          {selectorState.confirming
            ? t("settings.model.api.setting")
            : t("settings.model.defaultCard.setRoleModel", {
                role: t(meta.titleKey),
              })}
        </Button>
      </div>
    </div>
  );
};

const ModelConfig: React.FC<ModelConfigProps> = ({
  modelType,
  config,
  onUpdated,
  readOnly = false,
}) => {
  const { t } = useTranslation();
  const meta = MODEL_META[modelType];
  const { builtInModel, isConfigured, modelLabel, providerLabel } =
    buildModelSummary(t, config, modelType);
  const statusMeta = buildStatusMeta(t, isConfigured, builtInModel);

  const openEditor = () => {
    let modalKey = "";

    modalKey = Modal.show({
      title: t(meta.titleKey),
      width: 760,
      maxHeight: 720,
      footer: null,
      onClose: () => void 0,
      content: (
        <ModelConfigEditor
          modelType={modelType}
          config={config}
          onUpdated={onUpdated}
          readOnly={readOnly}
          onClose={() => Modal.close(modalKey)}
        />
      ),
    });
  };

  const openModelSelector = () => {
    let modalKey = "";

    modalKey = Modal.show({
      title: t("settings.model.defaultCard.platformSettingsTitle"),
      width: 940,
      height: 560,
      footer: null,
      content: (
        <ModelSelectorDialogContent
          modelType={modelType}
          onClose={() => Modal.close(modalKey)}
        />
      ),
    });
  };

  return (
    <div className="flex h-full w-full flex-col rounded-xl border border-border bg-surface-primary p-3 shadow-shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <div
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-semibold ${meta.badgeClassName}`}
          >
            {meta.badgeText}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex min-h-8 flex-wrap items-center gap-1.5">
              <div className="text-sm font-semibold text-text-primary">
                {t(meta.titleKey)}
              </div>
              <span
                aria-label={statusMeta.label}
                title={statusMeta.label}
                className={`inline-block h-2 w-2 rounded-full ${statusMeta.dotClassName}`}
              />
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={openModelSelector}>
            {t("settings.model.config.chooseModel")}
          </Button>
          <Button variant="ghost" size="sm" onClick={openEditor}>
            {readOnly
              ? t("settings.model.config.viewDetails")
              : t("settings.model.config.openEditor")}
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <SettingsStatBlock
          label={t("settings.model.config.connectionLabel", {
            provider: providerLabel,
          })}
          value={modelLabel}
          size="sm"
        />
      </div>

      <div className="mt-2 text-xs leading-5 text-text-secondary">
        {t(meta.subtitleKey)}
      </div>
    </div>
  );
};

export default ModelConfig;
