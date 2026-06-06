// src/components/config/ApiConfigCard.tsx
import React from "react";
import { RotateCcw, MoreHorizontal, LinkIcon, Eye } from "lucide-react";
import { Button, IconButton } from "@/shared/ui/Button";
import Tooltip from "@/shared/ui/Tooltip";

interface ApiConfigCardProps {
  platformName: string;
  apiKey: string;
  apiUrl: string;
  models: Array<{ id: string; name: string; enabled: boolean }>;
  onApiKeyChange: (value: string) => void;
  onApiUrlChange: (value: string) => void;
  onSetDefaultLLM: () => void;
  onSetDefaultEmbedding: () => void;
  onSetDefaultRerank: () => void;
}

/**
 * API 配置卡片
 * 配置平台的 API 密钥、地址和模型选择
 */
const ApiConfigCard: React.FC<ApiConfigCardProps> = ({
  platformName,
  apiKey,
  apiUrl,
  models,
  onApiKeyChange,
  onApiUrlChange,
  onSetDefaultLLM,
  onSetDefaultEmbedding,
  onSetDefaultRerank,
}) => (
  <div className="flex-1">
    {/* 标题 */}
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          {platformName}
        </h1>
        <IconButton>
          <LinkIcon className="w-4 h-4" />
        </IconButton>
      </div>
    </div>

    {/* API 密钥 */}
    <div className="mb-3">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        API 密钥
      </label>
      <div className="relative">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder="API 密钥"
          className="w-full px-3 py-2 pr-10 bg-white dark:bg-[#242424] border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black/50"
        />
        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
          <Eye className="w-4 h-4" />
        </button>
      </div>
    </div>

    {/* API 地址和模型选择 */}
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          API 地址
        </label>
        <div className="flex gap-1">
          <Tooltip text="测试连接">
            <IconButton>
              <RotateCcw className="w-4 h-4" />
            </IconButton>
          </Tooltip>
          <Tooltip text="复制">
            <IconButton>
              <MoreHorizontal className="w-4 h-4" />
            </IconButton>
          </Tooltip>
        </div>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <LinkIcon className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => onApiUrlChange(e.target.value)}
            placeholder="http://localhost:11434"
            className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#242424] border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black/50"
          />
        </div>
        <select className="px-3 py-2 bg-white dark:bg-[#242424] border border-gray-300 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black/50 min-w-[140px]">
          <option>选择模型...</option>
          {models
            .filter((m) => m.enabled)
            .map((model) => (
              <option key={model.id}>{model.name}</option>
            ))}
        </select>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        预览: http://localhost:11434/api/chat
      </p>
    </div>

    {/* 设为默认按钮组 */}
    <div className="flex gap-2 mt-4">
      <Button size="small" variant="secondary" onClick={onSetDefaultLLM}>
        设为默认 LLM
      </Button>
      <Button size="small" variant="secondary" onClick={onSetDefaultEmbedding}>
        设为默认 Embedding
      </Button>
      <Button size="small" variant="secondary" onClick={onSetDefaultRerank}>
        设为默认 Rerank
      </Button>
    </div>
  </div>
);

export default ApiConfigCard;
