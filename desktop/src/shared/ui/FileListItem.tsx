import { Trash2 } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import Card from "./Card";
import { FileIcon } from "./FileIcon";
import { IconButton } from "./Button";

interface FileListItemProps {
  name: string;
  extension: string;
  size: number;
  onRemove?: () => void;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export function FileListItem({
  name,
  extension,
  size,
  onRemove,
  onClick,
  active = false,
  className = "",
}: FileListItemProps) {
  const { t } = useTranslation();
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, index)).toFixed(2))} ${sizes[index]}`;
  };

  return (
    <Card
      className={`p-1 ${active ? "border-primary bg-primary/5" : ""} ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClick}
          disabled={!onClick}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary disabled:pointer-events-none"
        >
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-ui-control bg-surface-secondary">
            <FileIcon extension={extension} className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-text-primary">
              {name}
            </div>
            <div className="text-xs text-text-secondary">
              {extension} · {formatFileSize(size)}
            </div>
          </div>
        </button>

        {onRemove ? (
          <IconButton
            ariaLabel={t("ui.fileListItem.removeFile")}
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        ) : null}
      </div>
    </Card>
  );
}

export default FileListItem;
