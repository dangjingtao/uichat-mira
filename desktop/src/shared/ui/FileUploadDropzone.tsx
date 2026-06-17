import { CloudUpload } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";
import Card from "./Card";

interface FileUploadDropzoneProps {
  onSelectFiles: (files: FileList | null) => void;
  helperText?: React.ReactNode;
  accept?: string;
  maxCount?: number;
  className?: string;
  disabled?: boolean;
}

export function FileUploadDropzone({
  onSelectFiles,
  helperText,
  accept,
  maxCount,
  className = "",
  disabled = false,
}: FileUploadDropzoneProps) {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) {
      event.target.value = "";
      return;
    }

    const selectedFiles = event.target.files;
    if (!selectedFiles || selectedFiles.length === 0) {
      onSelectFiles(null);
      return;
    }

    // 如果设置了 maxCount，则限制文件数量
    if (maxCount && selectedFiles.length > maxCount) {
      const limitedFiles = Array.from(selectedFiles).slice(0, maxCount);
      const dataTransfer = new DataTransfer();
      limitedFiles.forEach((file) => dataTransfer.items.add(file));
      onSelectFiles(dataTransfer.files);
    } else {
      onSelectFiles(selectedFiles);
    }

    // 重置 input 以允许选择相同文件
    event.target.value = "";
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.click();
          }
        }}
        className={`flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
          disabled
            ? "cursor-not-allowed bg-surface-secondary/70 opacity-60"
            : "bg-surface-secondary hover:bg-surface-primary"
        } ${className}`}
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-primary shadow-shadow-sm">
          <CloudUpload className="h-4 w-4 text-icon-primary" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary">
            {t("ui.fileUploadDropzone.dragAndDrop")}
            <span className="ml-1 text-primary">
              {t("ui.fileUploadDropzone.selectFile")}
            </span>
          </div>
          {helperText ? (
            <div className="mt-0.5 text-xs leading-5 text-text-secondary">
              {helperText}
            </div>
          ) : null}
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple={!maxCount || maxCount > 1}
        className="hidden"
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
      />
    </>
  );
}
