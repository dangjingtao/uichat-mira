// src/components/ui/Tooltip.tsx
import React from "react";

interface TooltipProps {
  children: React.ReactNode;
  text: string;
}

/**
 * GitHub 风格的 Tooltip 组件
 * 鼠标悬停时显示提示文本
 */
const Tooltip: React.FC<TooltipProps> = ({ children, text }) => (
  <div className="group relative flex items-center">
    {children}
    <div className="absolute left-full ml-2 hidden group-hover:block whitespace-nowrap z-10">
      <div className="bg-black text-white text-xs rounded px-2 py-1 shadow-lg">
        {text}
        <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 border-4 border-transparent border-r-black"></div>
      </div>
    </div>
  </div>
);

export default Tooltip;
