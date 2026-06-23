import React, { useEffect, useMemo, useState } from "react";
import { LibraryBig, Search } from "lucide-react";
import { get } from "@/shared/lib/request";
import { Modal } from "./Modal";

export type SearchSelectModalItem = {
  id: string;
  label: string;
  description?: string | null;
  keywords?: string[];
  meta?: string;
  title?: string;
  disabled?: boolean;
};

type SearchSelectModalProps<TRawResponse> = {
  open: boolean;
  title: React.ReactNode;
  url: string;
  selectedId?: string | null;
  width?: number | string;
  searchPlaceholder?: string;
  emptyText?: string;
  loadingText?: string;
  loadErrorText?: string;
  normalizeItems: (response: TRawResponse) => SearchSelectModalItem[];
  onCheck: (item: SearchSelectModalItem) => boolean | Promise<boolean>;
  onClose: () => void;
};

const matchesSearch = (item: SearchSelectModalItem, query: string) => {
  const haystack = [
    item.label,
    item.description ?? "",
    item.meta ?? "",
    item.title ?? "",
    ...(item.keywords ?? []),
  ]
    .join("\n")
    .toLowerCase();

  return haystack.includes(query);
};

export default function SearchSelectModal<TRawResponse>({
  open,
  title,
  url,
  selectedId,
  width = 520,
  searchPlaceholder = "Search",
  emptyText = "No items found",
  loadingText = "Loading...",
  loadErrorText = "Failed to load data",
  normalizeItems,
  onCheck,
  onClose,
}: SearchSelectModalProps<TRawResponse>) {
  const [searchText, setSearchText] = useState("");
  const [items, setItems] = useState<SearchSelectModalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSearchText("");
      setErrorText(null);
      setSubmittingId(null);
      return;
    }

    let disposed = false;

    const loadItems = async () => {
      try {
        setLoading(true);
        setErrorText(null);
        const response = await get<TRawResponse>(url);
        if (disposed) {
          return;
        }

        setItems(normalizeItems(response));
      } catch (error) {
        if (disposed) {
          return;
        }

        setItems([]);
        setErrorText(error instanceof Error ? error.message : loadErrorText);
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    };

    void loadItems();

    return () => {
      disposed = true;
    };
  }, [loadErrorText, normalizeItems, open, url]);

  const visibleItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return items;
    }

    return items.filter((item) => matchesSearch(item, query));
  }, [items, searchText]);

  const handleCheck = async (item: SearchSelectModalItem) => {
    if (item.disabled || submittingId) {
      return;
    }

    try {
      setSubmittingId(item.id);
      const shouldClose = await onCheck(item);
      if (shouldClose) {
        onClose();
      }
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      width={width}
      height="min(64vh, 30rem)"
      footer={null}
      bodyClassName="p-0 bg-surface-elevated"
      onClose={onClose}
    >
      <div className="flex h-full min-h-0 flex-col bg-surface-elevated">
        <div className="shrink-0 bg-surface-elevated px-3 py-2.5">
          <label className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-icon-secondary">
              <Search className="h-4 w-4" />
            </span>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-ui-control border border-border bg-surface-primary pl-9 pr-3 text-sm text-text-primary shadow-shadow-sm transition-[background-color,border-color,box-shadow] duration-150 ease-out placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>

        <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-0">
          {loading ? (
            <div className="rounded-ui-panel border border-border bg-surface-secondary px-4 py-5 text-center text-sm text-text-secondary shadow-shadow-sm">
              {loadingText}
            </div>
          ) : errorText ? (
            <div className="rounded-ui-panel border border-danger-border bg-danger-soft px-4 py-5 text-center text-sm text-danger-text">
              {errorText}
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-ui-panel border border-border bg-surface-secondary px-4 py-5 text-center text-sm text-text-secondary shadow-shadow-sm">
              {emptyText}
            </div>
          ) : (
            <div className="grid gap-1.5">
              {visibleItems.map((item) => {
                const isSelected = !item.disabled && item.id === selectedId;
                const isSubmitting = item.id === submittingId;

                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={item.disabled || Boolean(submittingId)}
                    onClick={() => {
                      void handleCheck(item);
                    }}
                    title={item.title ?? item.label}
                    className={`flex w-full items-start justify-between gap-3 rounded-ui-panel border px-3.5 py-2.5 text-left transition-colors duration-150 ${
                      item.disabled
                        ? "border-border bg-surface-primary opacity-50"
                        : isSelected
                        ? "border-primary/35 bg-primary-1 text-primary"
                        : "border-border bg-surface-primary hover:border-primary/20 hover:bg-primary-1/70"
                    } ${item.disabled ? "cursor-not-allowed" : ""}`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-ui-control ${
                          isSelected ? "bg-primary text-white" : "bg-primary/10 text-primary"
                        }`}
                      >
                        <LibraryBig className="h-3.5 w-3.5" />
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
                              isSelected ? "text-primary/80" : "text-text-secondary"
                            }`}
                          >
                            {item.description}
                          </p>
                        ) : null}
                      </div>
                      {item.meta ? (
                        <div
                          className={`shrink-0 pt-0.5 text-right text-[11px] leading-5 ${
                            isSelected ? "text-primary/75" : "text-text-tertiary"
                          }`}
                        >
                          {isSubmitting ? "Applying..." : item.meta}
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
    </Modal>
  );
}
