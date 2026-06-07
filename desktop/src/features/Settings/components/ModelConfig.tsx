/**
 * 模型配置组件
 * 管理和配置不同类型的模型（LLM、Embedding、ReRank）
 */
import { useState } from "react";
import { Button } from "@/shared/ui/Button";
import { SelectInput, NumberInput } from "@/shared/ui/Input";

/** 支持的模型类型 */
type ModelType = "llm" | "embedding" | "reRank";

/** 参数元数据接口，定义每个配置项的结构 */
interface ParamMeta {
  key: string;
  label: string;
  type: "number" | "select" | "boolean";
  step?: number;
  options?: { value: string; label: string }[];
  disabledKey?: string;
  defaultValue: number | string | boolean;
}

/** 模型元数据接口，定义一个模型类型的完整配置 */
interface ModelMeta {
  title: string;
  subtitle: string;
  iconBg: string;
  iconText: string;
  iconColor: string;
  params: ParamMeta[];
  defaultEnabled: boolean;
  defaultName: string;
}

/** 配置值类型 */
type ConfigValue = number | string | boolean;

/** 模型配置状态类型 */
type ConfigState = Record<string, ConfigValue>;

/** 各类型模型的元数据配置 */
const MODEL_META: Record<ModelType, ModelMeta> = {
  llm: {
    title: "",
    subtitle: "用于对话生成、文本理解",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconText: "LM",
    iconColor: "text-blue-600 dark:text-blue-400",
    defaultEnabled: true,
    defaultName: "gemma4:e4b",
    params: [
      {
        key: "temperature",
        label: "Temperature",
        type: "number",
        step: 0.1,
        defaultValue: 0.7,
      },
      {
        key: "topP",
        label: "Top P",
        type: "number",
        step: 0.1,
        defaultValue: 0.9,
      },
      { key: "topK", label: "Top K", type: "number", defaultValue: 40 },
      {
        key: "maxTokens",
        label: "Max Tokens",
        type: "number",
        defaultValue: 2048,
      },
      {
        key: "frequencyPenalty",
        label: "Frequency Penalty",
        type: "number",
        step: 0.1,
        defaultValue: 0,
      },
      {
        key: "presencePenalty",
        label: "Presence Penalty",
        type: "number",
        step: 0.1,
        defaultValue: 0,
      },
    ],
  },
  embedding: {
    title: "",
    subtitle: "用于向量化、语义搜索",
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconText: "EM",
    iconColor: "text-green-600 dark:text-green-400",
    defaultEnabled: true,
    defaultName: "nomic-embed-text",
    params: [
      {
        key: "dimensions",
        label: "Dimensions",
        type: "number",
        defaultValue: 768,
      },
      {
        key: "batchSize",
        label: "Batch Size",
        type: "number",
        defaultValue: 32,
      },
      {
        key: "normalize",
        label: "Normalize",
        type: "select",
        options: [
          { value: "true", label: "True" },
          { value: "false", label: "False" },
        ],
        defaultValue: "true",
      },
      {
        key: "chunkSize",
        label: "Chunk Size",
        type: "number",
        defaultValue: 512,
      },
      {
        key: "chunkOverlap",
        label: "Chunk Overlap",
        type: "number",
        defaultValue: 64,
      },
    ],
  },
  reRank: {
    title: "未配置",
    subtitle: "用于结果重排序、相关性评分",
    iconBg: "bg-gray-100 dark:bg-gray-800",
    iconText: "RE",
    iconColor: "text-gray-600 dark:text-gray-400",
    defaultEnabled: false,
    defaultName: "",
    params: [
      {
        key: "topN",
        label: "Top N",
        type: "number",
        disabledKey: "enabled",
        defaultValue: 5,
      },
      {
        key: "scoreThreshold",
        label: "Score Threshold",
        type: "number",
        step: 0.1,
        disabledKey: "enabled",
        defaultValue: 0.5,
      },
      {
        key: "windowSize",
        label: "Window Size",
        type: "number",
        disabledKey: "enabled",
        defaultValue: 3,
      },
      {
        key: "strategy",
        label: "Strategy",
        type: "select",
        options: [
          { value: "cross-encoder", label: "Cross-Encoder" },
          { value: "bi-encoder", label: "Bi-Encoder" },
        ],
        disabledKey: "enabled",
        defaultValue: "cross-encoder",
      },
    ],
  },
};

/**
 * 从 params 构建初始配置对象
 * @param params 参数元数据数组
 * @returns 初始配置对象
 */
const buildInitialConfig = (params: ParamMeta[]): ConfigState => {
  return params.reduce((acc, param) => {
    acc[param.key] = param.defaultValue;
    return acc;
  }, {} as ConfigState);
};

/**
 * 转换 select 输入的字符串值为正确的类型
 * @param key 参数 key
 * @param value 输入值
 * @returns 转换后的值
 */
const convertSelectValue = (key: string, value: string): ConfigValue => {
  if (key === "normalize") {
    return value === "true";
  }
  return value;
};

interface ConfigGridProps {
  items: ParamMeta[];
  config: ConfigState;
  onChange: (key: string, value: ConfigValue) => void;
}

/**
 * 配置网格组件
 * 渲染配置项的输入组件
 */
const ConfigGrid: React.FC<ConfigGridProps> = ({ items, config, onChange }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
      {items.map((item) => {
        const value = config[item.key];
        const disabled = item.disabledKey ? !config[item.disabledKey] : false;

        if (item.type === "select") {
          return (
            <SelectInput
              key={item.key}
              label={item.label}
              value={
                typeof value === "boolean"
                  ? value.toString()
                  : (value as string)
              }
              onChange={(newValue) => {
                onChange(item.key, convertSelectValue(item.key, newValue));
              }}
              options={item.options!}
              disabled={disabled}
            />
          );
        } else {
          return (
            <NumberInput
              key={item.key}
              label={item.label}
              value={value as number}
              onChange={(newValue) => onChange(item.key, newValue)}
              step={item.step}
              disabled={disabled}
            />
          );
        }
      })}
    </div>
  );
};

interface ModelConfigProps {
  modelType: ModelType;
}

/**
 * 模型配置主组件
 * 管理单个类型模型的配置，包括启用/禁用、参数编辑和保存
 */
const ModelConfig: React.FC<ModelConfigProps> = ({ modelType }) => {
  const meta = MODEL_META[modelType];
  const [config, setConfig] = useState<ConfigState>(() => ({
    enabled: meta.defaultEnabled,
    name: meta.defaultName,
    ...buildInitialConfig(meta.params),
  }));
  const [isChanged, setIsChanged] = useState(false);

  /**
   * 处理配置项变更
   */
  const handleChange = (key: string, value: ConfigValue) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setIsChanged(true);
  };

  /**
   * 切换模型启用/禁用状态
   */
  const handleToggleEnabled = () => {
    setConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
    setIsChanged(true);
  };

  /**
   * 保存配置
   */
  const handleSave = () => {
    console.log("Saving config:", config);
    setIsChanged(false);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-8 h-8 rounded-lg ${meta.iconBg} flex items-center justify-center`}
          >
            <span className={`text-sm font-bold ${meta.iconColor}`}>
              {meta.iconText}
            </span>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {meta.title || config.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {meta.subtitle}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="small"
            variant={config.enabled ? "primary" : "secondary"}
            onClick={handleToggleEnabled}
          >
            {config.enabled ? "已启用" : "已禁用"}
          </Button>
          <Button
            disabled={!isChanged}
            size="small"
            variant="secondary"
            onClick={handleSave}
          >
            保存
          </Button>
        </div>
      </div>

      <ConfigGrid items={meta.params} config={config} onChange={handleChange} />
    </div>
  );
};

export default ModelConfig;
