import React, {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Check, Image as ImageIcon, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import Badge from "./Badge";
import { Button } from "./Button";
import ImagePreviewOverlay from "./ImagePreviewOverlay";
import { Modal } from "./Modal";

export interface AvatarPickerOption {
  id: string;
  label: string;
  src: string;
  alt?: string;
  description?: string;
  tags?: string[];
  disabled?: boolean;
}

interface AvatarPickerProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "title"> {
  value?: string | null;
  options: AvatarPickerOption[];
  onChange: (option: AvatarPickerOption) => void;
  onClear?: () => void;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  title?: React.ReactNode;
  placeholder?: React.ReactNode;
  disabled?: boolean;
  allowClear?: boolean;
  emptyText?: React.ReactNode;
  searchPlaceholder?: string;
  className?: string;
}

const matchesSearch = (option: AvatarPickerOption, query: string) => {
  if (!query) {
    return true;
  }

  const haystack = [
    option.label,
    option.description ?? "",
    ...(option.tags ?? []),
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(query);
};

function AvatarThumb({
  option,
  sizeClassName,
}: {
  option?: AvatarPickerOption | null;
  sizeClassName: string;
}) {
  if (!option) {
    return (
      <div
        className={`flex items-center justify-center rounded-full border border-border bg-surface-secondary text-icon-secondary ${sizeClassName}`}
      >
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={option.src}
      alt={option.alt ?? option.label}
      className={`rounded-full border border-border bg-surface-secondary object-cover ${sizeClassName}`}
      draggable={false}
    />
  );
}

export default function AvatarPicker({
  value,
  options,
  onChange,
  onClear,
  label,
  hint,
  title,
  placeholder,
  disabled = false,
  allowClear = false,
  emptyText,
  searchPlaceholder,
  className = "",
  ...divProps
}: AvatarPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [draftId, setDraftId] = useState<string | null>(value ?? null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const deferredSearchText = useDeferredValue(searchText);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const draftOption = useMemo(
    () => options.find((option) => option.id === draftId) ?? null,
    [draftId, options],
  );

  const visibleOptions = useMemo(() => {
    const query = deferredSearchText.trim().toLowerCase();
    return options.filter((option) => matchesSearch(option, query));
  }, [deferredSearchText, options]);

  useEffect(() => {
    if (!open) {
      setSearchText("");
      setDraftId(value ?? null);
      return;
    }

    setDraftId(value ?? null);
  }, [open, value]);

  const pickerTitle = title ?? t("ui.avatarPicker.title");
  const pickerPlaceholder =
    placeholder ?? t("ui.avatarPicker.placeholder");
  const pickerEmptyText = emptyText ?? t("ui.avatarPicker.empty");
  const pickerSearchPlaceholder =
    searchPlaceholder ?? t("ui.avatarPicker.searchPlaceholder");

  return (
    <>
      <div {...divProps} className={className}>
        {label ? (
          <div className="mb-2 text-sm font-medium text-text-primary">
            {label}
          </div>
        ) : null}
        {hint ? (
          <div className="mb-2 text-xs leading-5 text-text-secondary">
            {hint}
          </div>
        ) : null}

        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 rounded-ui-panel border border-border bg-surface-primary px-3.5 py-3 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AvatarThumb option={selectedOption} sizeClassName="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-text-primary">
              {selectedOption?.label ?? pickerPlaceholder}
            </div>
            <div className="mt-0.5 text-xs leading-5 text-text-secondary">
              {selectedOption?.description ??
                t("ui.avatarPicker.triggerHint")}
            </div>
          </div>
          <span className="shrink-0 text-sm text-primary">
            {selectedOption
              ? t("ui.avatarPicker.changeAction")
              : t("ui.avatarPicker.selectAction")}
          </span>
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={pickerTitle}
        width={860}
        height="min(78vh, 44rem)"
        bodyClassName="min-h-0 overflow-hidden p-0"
        footer={
          <>
            {allowClear ? (
              <Button
                variant="ghost"
                onClick={() => {
                  onClear?.();
                  setOpen(false);
                }}
              >
                {t("ui.avatarPicker.clearAction")}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t("common.actions.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (draftOption) {
                  onChange(draftOption);
                }
                setOpen(false);
              }}
              disabled={!draftOption || draftOption.disabled}
            >
              {t("common.actions.confirm")}
            </Button>
          </>
        }
      >
        <div className="grid h-full min-h-0 gap-0 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="min-h-0 overflow-hidden border-b border-border bg-surface-secondary/70 p-4 md:border-b-0 md:border-r">
            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                {t("ui.avatarPicker.previewLabel")}
              </div>
              <button
                type="button"
                disabled={!draftOption}
                onClick={() => {
                  if (draftOption) {
                    setPreviewSrc(draftOption.src);
                  }
                }}
                className="flex w-full flex-col items-center gap-3 rounded-ui-panel border border-border bg-surface-primary px-4 py-5 text-center transition-colors hover:bg-surface-secondary disabled:cursor-default disabled:hover:bg-surface-primary"
              >
                <AvatarThumb option={draftOption} sizeClassName="h-24 w-24" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text-primary">
                    {draftOption?.label ?? t("ui.avatarPicker.unselected")}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-text-secondary">
                    {draftOption?.description ??
                      t("ui.avatarPicker.previewHint")}
                  </div>
                </div>
                {draftOption?.tags?.length ? (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {draftOption.tags.map((tag) => (
                      <Badge key={tag} variant="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </button>
            </div>
          </div>

          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-border bg-surface-elevated px-4 py-4">
              <label className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon-secondary">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={pickerSearchPlaceholder}
                  className="h-10 w-full rounded-ui-control border border-border bg-surface-primary pl-9 pr-3 text-sm text-text-primary shadow-shadow-sm transition-[background-color,border-color,box-shadow] duration-150 ease-out placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>

            <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
              {visibleOptions.length === 0 ? (
                <div className="rounded-ui-panel border border-border bg-surface-secondary px-4 py-8 text-center text-sm text-text-secondary">
                  {pickerEmptyText}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                  {visibleOptions.map((option) => {
                    const isActive = option.id === draftId;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={option.disabled}
                        onClick={() => setDraftId(option.id)}
                        className={`group rounded-ui-panel border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 ${
                          option.disabled
                            ? "cursor-not-allowed border-border bg-surface-primary opacity-50"
                            : isActive
                            ? "border-primary/35 bg-primary/5"
                            : "border-border bg-surface-primary hover:bg-surface-secondary"
                        }`}
                      >
                        <div className="relative">
                          <div className="flex justify-center">
                            <AvatarThumb option={option} sizeClassName="h-16 w-16" />
                          </div>
                          {isActive ? (
                            <span className="absolute right-0 top-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-shadow-sm">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3">
                          <div className="truncate text-sm font-medium text-text-primary">
                            {option.label}
                          </div>
                          {option.description ? (
                            <div className="mt-0.5 line-clamp-2 text-xs leading-5 text-text-secondary">
                              {option.description}
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ImagePreviewOverlay
        open={Boolean(previewSrc)}
        src={previewSrc}
        alt={draftOption?.alt ?? draftOption?.label ?? ""}
        onClose={() => setPreviewSrc(null)}
      />
    </>
  );
}
