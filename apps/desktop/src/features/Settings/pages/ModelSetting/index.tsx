// src/pages/ModelSettings.tsx
import { useState } from "react";
import DefaultModelCard from "../../components/DefaultModelCard";
import PlatformCard from "../../components/PlatformCard";
import ApiConfigCard from "../../components/ApiConfigCard";

interface Model {
  id: string;
  name: string;
  enabled: boolean;
  icon?: string;
}

/**
 * 模型设置主页面
 */
export default function ModelSettings() {
  const [selectedPlatform, setSelectedPlatform] = useState("ollama");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("http://localhost:11434");
  const [models] = useState<Model[]>([
    { id: "1", name: "gemma4:e4b", enabled: true, icon: "G" },
    { id: "2", name: "translategemma:4b", enabled: true, icon: "T" },
    { id: "3", name: "qwen3:latest", enabled: false, icon: "Q" },
    { id: "4", name: "mistral-small3.1:latest", enabled: true, icon: "M" },
  ]);

  const platforms = [
    { id: "ollama", name: "Ollama", icon: "O" },
    { id: "lmstudio", name: "LM Studio", icon: "L" },
    { id: "OpenAI", name: "OpenAI", icon: "A" },
  ];

  const setAsDefault = (type: "llm" | "embedding" | "rerank") => {
    console.log(`Set as default ${type}`);
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-full mx-auto p-4 bg-white dark:bg-[#171717]">
      {/* 默认模型配置卡片 */}
      <DefaultModelCard />

      {/* 平台和API配置卡片 */}
      <div className="flex max-h-96 flex-col border rounded-2xl md:flex-row gap-6 w-full max-w-full mx-auto p-4 bg-white dark:bg-[#171717]">
        {/* 左侧：平台列表 */}
        <PlatformCard
          platforms={platforms}
          selectedPlatform={selectedPlatform}
          onSelectPlatform={setSelectedPlatform}
        />

        {/* 右侧：API配置 */}
        <ApiConfigCard
          platformName="Ollama"
          apiKey={apiKey}
          apiUrl={apiUrl}
          models={models}
          onApiKeyChange={setApiKey}
          onApiUrlChange={setApiUrl}
          onSetDefaultLLM={() => setAsDefault("llm")}
          onSetDefaultEmbedding={() => setAsDefault("embedding")}
          onSetDefaultRerank={() => setAsDefault("rerank")}
        />
      </div>
    </div>
  );
}
