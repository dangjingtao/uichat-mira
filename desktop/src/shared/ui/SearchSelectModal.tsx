import React, { useEffect, useMemo, useState } from "react";
import { get } from "@/shared/lib/request";
import SearchSelectModalChrome from "./SearchSelectModalChrome";

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
    <SearchSelectModalChrome
      open={open}
      title={title}
      width={width}
      height="min(70vh, 36rem)"
      searchText={searchText}
      searchPlaceholder={searchPlaceholder}
      loading={loading}
      loadingText={loadingText}
      errorText={errorText}
      emptyText={emptyText}
      selectedId={selectedId}
      submittingId={submittingId}
      items={visibleItems}
      onSearchTextChange={setSearchText}
      onItemClick={(item) => {
        void handleCheck(item);
      }}
      onClose={onClose}
    />
  );
}
