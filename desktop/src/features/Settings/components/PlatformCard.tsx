// src/components/platforms/PlatformCard.tsx
import React from "react";
import { Plus, CheckCircle } from "lucide-react";
import Tooltip from "@/shared/ui/Tooltip";
import IconButton from "@/shared/ui/IconButton";

interface Platform {
  id: string;
  name: string;
  icon: string;
}

interface PlatformCardProps {
  platforms: Platform[];
  selectedPlatform: string;
  onSelectPlatform: (id: string) => void;
}

/**
 * 平台列表卡片
 * 显示可用的模型平台列表，支持选择和添加新平台
 */
const PlatformCard: React.FC<PlatformCardProps> = ({
  platforms,
  selectedPlatform,
  onSelectPlatform,
}) => (
  <div className="w-full md:w-64 shrink-0">
    <div className="bg-gray-50 dark:bg-[#1a1a1a] rounded-lg p-2">
      {/* 标题和操作 */}
      <div className="flex items-center text-sm justify-between px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        <span>模型平台</span>
        <Tooltip text="添加平台">
          <button className="hover:text-gray-900 dark:hover:text-white">
            <Plus className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      {/* 平台列表 */}
      <div className="mt-2 space-y-1">
        {platforms.map((platform) => (
          <div
            key={platform.id}
            onClick={() => onSelectPlatform(platform.id)}
            className={`flex items-center justify-between px-3 py-2.5 rounded-md cursor-pointer transition ${
              selectedPlatform === platform.id
                ? "bg-white dark:bg-[#242424] shadow-sm"
                : "hover:bg-white/50 dark:hover:bg-white/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-sm font-bold text-gray-700 dark:text-gray-300">
                {platform.icon}
              </div>
              <span className="text-sm text-gray-900 dark:text-white">
                {platform.name}
              </span>
            </div>
            <div className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full">
              <CheckCircle className="w-3 h-3 inline-block mr-1" />
              已配置
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
export default PlatformCard;
