import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { listKnowledgeBases, type KnowledgeBaseSummary } from "@/shared/api/knowledgeBase";

type ChatKnowledgeBaseStateValue = {
  knowledgeBases: KnowledgeBaseSummary[];
  hasAnyEnabledDocuments: boolean;
  refresh: () => Promise<void>;
};

const ChatKnowledgeBaseStateContext =
  createContext<ChatKnowledgeBaseStateValue | null>(null);

export function ChatKnowledgeBaseStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBaseSummary[]>([]);

  const refresh = useCallback(async () => {
    const nextKnowledgeBases = await listKnowledgeBases();
    setKnowledgeBases(nextKnowledgeBases);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      knowledgeBases,
      hasAnyEnabledDocuments: knowledgeBases.some(
        (item) => item.enabledDocumentCount > 0,
      ),
      refresh,
    }),
    [knowledgeBases, refresh],
  );

  return (
    <ChatKnowledgeBaseStateContext.Provider value={value}>
      {children}
    </ChatKnowledgeBaseStateContext.Provider>
  );
}

export function useChatKnowledgeBaseState() {
  const context = useContext(ChatKnowledgeBaseStateContext);
  return (
    context ?? {
      knowledgeBases: [],
      hasAnyEnabledDocuments: false,
      refresh: async () => {},
    }
  );
}
