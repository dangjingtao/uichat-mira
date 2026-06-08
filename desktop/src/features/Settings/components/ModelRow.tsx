import React, { useState } from "react";
import { Edit, GripVertical, Power, Trash2 } from "lucide-react";
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
    <div className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-primary">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <GripVertical className="h-4 w-4 cursor-grab text-icon-secondary" />

        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-primary text-[10px] font-semibold text-text-secondary">
            {model.icon || "M"}
          </div>
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleUpdate}
              onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
              className="min-w-[116px] rounded-md border border-border bg-surface-primary px-2 py-1 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoFocus
            />
          ) : (
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] text-text-primary">
                {model.name}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  model.enabled
                    ? "bg-success/10 text-success"
                    : "bg-surface-tertiary text-text-secondary"
                }`}
              >
                {model.enabled ? "启用" : "禁用"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Tooltip text="编辑">
          <IconButton onClick={() => setIsEditing(true)} ariaLabel="编辑模型">
            <Edit className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text={model.enabled ? "禁用" : "启用"}>
          <IconButton
            onClick={() => onToggleStatus(model.id)}
            ariaLabel={model.enabled ? "禁用模型" : "启用模型"}
          >
            <Power className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text="删除">
          <IconButton
            onClick={() => onDelete(model.id)}
            className="text-danger hover:text-danger"
            ariaLabel="删除模型"
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};

export default ModelRow;
