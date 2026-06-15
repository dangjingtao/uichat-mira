import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getKnowledgeBase, type KnowledgeBaseSummary } from "@/shared/api/knowledgeBase";

type KnowledgeBaseAvailabilityContextValue = {
  summary: KnowledgeBaseSummary | null;
  loading: boolean;
  hasEnabledDocuments: boolean;
  refresh: () => Promise<KnowledgeBaseSummary | null>;
};

const KnowledgeBaseAvailabilityContext =
  createContext<KnowledgeBaseAvailabilityContextValue | null>(null);

export function KnowledgeBaseAvailabilityProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [summary, setSummary] = useState<KnowledgeBaseSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const nextSummary = await getKnowledgeBase();
      setSummary(nextSummary);
      return nextSummary;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<KnowledgeBaseAvailabilityContextValue>(
    () => ({
      summary,
      loading,
      hasEnabledDocuments: (summary?.enabledDocumentCount ?? 0) > 0,
      refresh,
    }),
    [loading, refresh, summary],
  );

  return (
    <KnowledgeBaseAvailabilityContext.Provider value={value}>
      {children}
    </KnowledgeBaseAvailabilityContext.Provider>
  );
}

export function useKnowledgeBaseAvailability() {
  const context = useContext(KnowledgeBaseAvailabilityContext);

  if (!context) {
    throw new Error(
      "useKnowledgeBaseAvailability must be used within KnowledgeBaseAvailabilityProvider",
    );
  }

  return context;
}
