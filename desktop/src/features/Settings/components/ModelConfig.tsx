import { useEffect, useMemo, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { NumberInput, SelectInput } from "@/shared/ui/Input";
import { message } from "@/shared/ui/Message";
import {
  type RoleModelConfig,
  type RoleModelType,
  updateRoleModelConfigParams,
} from "@/shared/api/modelSettings";

interface ParamMeta {
  key: string;
  label: string;
  type: "number" | "select";
  step?: number;
  options?: { value: string; label: string }[];
}

interface ModelMeta {
  title: string;
  subtitle: string;
  badgeText: string;
  badgeClassName: string;
  params: ParamMeta[];
}

type ConfigValue = number | string | boolean;
type ConfigState = Record<string, ConfigValue>;

const PROVIDER_LABELS = {
  ollama: "Ollama",
  lmstudio: "LM Studio",
  openai: "OpenAI",
  cloudflare: "Cloudflare",
} as const;

const MODEL_META: Record<RoleModelType, ModelMeta> = {
  llm: {
    title: "LLM",
    subtitle: "用于对话生成和文本理解",
    badgeText: "LM",
    badgeClassName: "bg-primary/10 text-primary",
    params: [
      { key: "temperature", label: "Temperature", type: "number", step: 0.1 },
      { key: "topP", label: "Top P", type: "number", step: 0.1 },
      { key: "topK", label: "Top K", type: "number" },
      { key: "maxTokens", label: "Max Tokens", type: "number" },
      { key: "frequencyPenalty", label: "Frequency Penalty", type: "number", step: 0.1 },
      { key: "presencePenalty", label: "Presence Penalty", type: "number", step: 0.1 },
    ],
  },
  embedding: {
    title: "Embedding",
    subtitle: "用于向量化和语义搜索",
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
    title: "ReRank",
    subtitle: "用于结果重排和相关性评分",
    badgeText: "RE",
    badgeClassName: "bg-surface-tertiary text-text-secondary",
    params: [
      { key: "topN", label: "Top N", type: "number" },
      { key: "scoreThreshold", label: "Score Threshold", type: "number", step: 0.1 },
      { key: "windowSize", label: "Window Size", type: "number" },
      {
        key: "strategy",
        label: "Strategy",
        type: "select",
        options: [
          { value: "cross-encoder", label: "Cross-Encoder" },
          { value: "bi-encoder", label: "Bi-Encoder" },
        ],
      },
    ],
  },
};

const normalizeConfigState = (config: RoleModelConfig | null | undefined): ConfigState => {
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
}

const ModelConfig: React.FC<ModelConfigProps> = ({
  modelType,
  config,
  onUpdated,
}) => {
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
    ? PROVIDER_LABELS[config.providerCode]
    : "未配置";

  const handleChange = (key: string, value: ConfigValue) => {
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
      message.success("参数已保存");
      setIsChanged(false);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "保存参数失败";
      message.error(messageText);
    } finally {
      setIsSaving(false);
    }
  };

  const fields = useMemo(() => meta.params, [meta.params]);

  return (
    <div className="rounded-xl border border-border bg-surface-primary p-3 shadow-shadow-sm">
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
                {meta.title}
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  isConfigured
                    ? "bg-success/10 text-success"
                    : "bg-surface-tertiary text-text-secondary"
                }`}
              >
                {isConfigured ? "已配置" : "未配置"}
              </span>
            </div>
            <div className="text-xs leading-4 text-text-secondary">{meta.subtitle}</div>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          disabled={!isConfigured || !isChanged || isSaving}
          onClick={handleSave}
        >
          {isSaving ? "保存中..." : "保存"}
        </Button>
      </div>

      <div className="mb-2.5 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
            当前平台
          </div>
          <div className="mt-1 text-sm text-text-primary">{providerLabel}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface-secondary px-3 py-2">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
            当前模型
          </div>
          <div className="mt-1 truncate text-sm text-text-primary">
            {config?.name || "请在平台模型设置中选择"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {fields.map((field) => {
          const value = localConfig[field.key];

          if (field.type === "select") {
            return (
              <SelectInput
                key={field.key}
                label={field.label}
                value={typeof value === "boolean" ? value.toString() : String(value ?? "")}
                onChange={(nextValue) =>
                  handleChange(
                    field.key,
                    field.key === "normalize" ? nextValue === "true" : nextValue,
                  )
                }
                options={field.options ?? []}
                compact
                disabled={!isConfigured}
              />
            );
          }

          return (
            <NumberInput
              key={field.key}
              label={field.label}
              value={Number(value ?? 0)}
              onChange={(nextValue) => handleChange(field.key, nextValue)}
              step={field.step}
              compact
              disabled={!isConfigured}
            />
          );
        })}
      </div>
    </div>
  );
};

export default ModelConfig;
