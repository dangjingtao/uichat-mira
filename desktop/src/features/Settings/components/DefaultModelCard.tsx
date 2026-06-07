// src/components/models/DefaultModelCard.tsx
import ModelConfig from "./ModelConfig";

/**
 * 默认模型配置卡片
 * 展示和配置三种类型的默认模型：LLM、Embedding、Rerank
 */
const DefaultModelCard: React.FC = () => {
  return (
    <div className="flex flex-col border rounded-2xl gap-6 w-full max-w-full mx-auto p-4 bg-white dark:bg-[#171717]">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            D
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              默认模型配置
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              配置不同任务使用的默认模型
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <ModelConfig modelType="llm" />
        <ModelConfig modelType="embedding" />
        <ModelConfig modelType="reRank" />
      </div>
    </div>
  );
};

export default DefaultModelCard;
