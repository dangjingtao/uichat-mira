import React from "react";
import { LibraryBig, Search, X } from "lucide-react";
import { IconButton } from "./Button";
import { Modal } from "./Modal";
import type { SearchSelectModalItem } from "./SearchSelectModal";

type SearchSelectModalChromeProps = {
  open: boolean;
  title: React.ReactNode;
  width?: number | string;
  height?: number | string;
  searchText: string;
  searchPlaceholder: string;
  loading: boolean;
  loadingText: string;
  errorText: string | null;
  emptyText: string;
  selectedId?: string | null;
  submittingId: string | null;
  items: SearchSelectModalItem[];
  onSearchTextChange: (value: string) => void;
  onItemClick: (item: SearchSelectModalItem) => void;
  onClose: () => void;
};

export default function SearchSelectModalChrome({
  open,
  title,
  width,
  height,
  searchText,
  searchPlaceholder,
  loading,
  loadingText,
  errorText,
  emptyText,
  selectedId,
  submittingId,
  items,
  onSearchTextChange,
  onItemClick,
  onClose,
}: SearchSelectModalChromeProps) {
  return (
    <Modal
      open={open}
      title={null}
      width={width}
      height={height}
      footer={null}
      showCloseButton={false}
      bodyClassName="!px-0 !py-0 !p-0 bg-transparent"
      onClose={onClose}
    >
      <div className="flex h-full min-h-0 flex-col text-text-primary">
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            {title ? (
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
                {title}
              </div>
            ) : null}

            <label className={title ? "mt-2 block" : "block"}>
              <span className="sr-only">{searchPlaceholder}</span>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon-secondary">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  autoFocus
                  value={searchText}
                  onChange={(event) => onSearchTextChange(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-10 w-full rounded-ui-control border border-border bg-surface-primary pl-9 pr-3 text-sm text-text-primary shadow-shadow-sm transition-[background-color,border-color,box-shadow] duration-150 ease-out placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </label>
          </div>

          <IconButton ariaLabel="Close search dialog" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="rounded-ui-panel border border-border bg-surface-secondary px-4 py-5 text-center text-sm text-text-secondary">
              {loadingText}
            </div>
          ) : errorText ? (
            <div className="rounded-ui-panel border border-danger-border bg-danger-soft px-4 py-5 text-center text-sm text-danger-text">
              {errorText}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-ui-panel border border-border bg-surface-secondary px-4 py-5 text-center text-sm text-text-secondary">
              {emptyText}
            </div>
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => {
                const isSelected = !item.disabled && item.id === selectedId;
                const isSubmitting = item.id === submittingId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled || Boolean(submittingId)}
                    onClick={() => onItemClick(item)}
                    title={item.title ?? item.label}
                    className={`flex w-full items-start gap-3 rounded-ui-control border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated ${
                      item.disabled
                        ? "cursor-not-allowed border-border bg-surface-primary opacity-50"
                        : isSelected
                        ? "border-primary/25 bg-primary/5"
                        : "border-transparent bg-transparent hover:border-border hover:bg-surface-secondary/70"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-ui-control border ${
                        isSelected
                          ? "border-primary/15 bg-primary/10 text-primary"
                          : "border-border bg-surface-secondary text-icon-secondary"
                      }`}
                    >
                      <LibraryBig className="h-4 w-4" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-sm font-medium ${
                          isSelected ? "text-primary" : "text-text-primary"
                        }`}
                      >
                        {item.label}
                      </div>

                      {item.description ? (
                        <p
                          className={`mt-0.5 line-clamp-1 text-[13px] leading-5 ${
                            isSelected ? "text-primary/75" : "text-text-secondary"
                          }`}
                        >
                          {item.description}
                        </p>
                      ) : null}
                    </div>

                    {item.meta ? (
                      <div
                        className={`shrink-0 pt-0.5 text-right text-[12px] leading-5 ${
                          isSelected ? "text-primary/70" : "text-text-tertiary"
                        }`}
                      >
                        {isSubmitting ? "Applying..." : item.meta}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
