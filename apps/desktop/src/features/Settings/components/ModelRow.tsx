// src/components/models/ModelRow.tsx
import React, { useState } from "react";
import { GripVertical, Edit, Settings, Trash2 } from "lucide-react";
import { IconButton } from "@/shared/ui/Button";
import Tooltip from "@/shared/ui/Tooltip";

interface Model {
  id: string;
  name: string;
  enabled: boolean;
  icon?: string;
}

interface ModelRowProps {
  model: Model;
  onEdit: (model: Model) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string) => void;
}

/**
 * 模型行组件
 * 显示单个模型的信息，支持编辑、删除和拖拽排序
 */
const ModelRow: React.FC<ModelRowProps> = ({
  model,
  onEdit,
  onDelete,
  onToggleStatus,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(model.name);

  const handleUpdate = () => {
    onEdit({ ...model, name: editValue });
    setIsEditing(false);
  };

  return (
    <div className="group flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* 拖拽手柄 */}
        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />

        {/* 模型名称和编辑输入 */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300 shrink-0">
            {model.icon || "M"}
          </div>
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleUpdate}
              onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
              className="bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-black px-1 py-0.5 rounded border border-gray-200 dark:border-gray-700 min-w-[120px]"
              autoFocus
            />
          ) : (
            <span className="text-sm text-gray-900 dark:text-white truncate">
              {model.name}
            </span>
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Tooltip text="编辑">
          <IconButton onClick={() => setIsEditing(true)}>
            <Edit className="w-4 h-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text="设置">
          <IconButton>
            <Settings className="w-4 h-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text="删除">
          <IconButton
            onClick={() => onDelete(model.id)}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};

export default ModelRow;
