import React, { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
                {model.enabled ? t("settings.model.modelRow.enabled") : t("settings.model.modelRow.disabled")}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Tooltip text={t("settings.model.modelRow.edit")}>
          <IconButton onClick={() => setIsEditing(true)} ariaLabel={t("settings.model.modelRow.editAria")}>
            <Edit className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text={model.enabled ? t("settings.model.modelRow.disable") : t("settings.model.modelRow.enable")}>
          <IconButton
            onClick={() => onToggleStatus(model.id)}
            ariaLabel={model.enabled ? t("settings.model.modelRow.disableAria") : t("settings.model.modelRow.enableAria")}
          >
            <Power className="h-4 w-4" />
          </IconButton>
        </Tooltip>
        <Tooltip text={t("settings.model.modelRow.delete")}>
          <IconButton
            onClick={() => onDelete(model.id)}
            className="text-danger hover:text-danger"
            ariaLabel={t("settings.model.modelRow.deleteAria")}
          >
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </Tooltip>
      </div>
    </div>
  );
};

export default ModelRow;
