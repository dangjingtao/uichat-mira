import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChatRuntime } from "@/shared/uchat/core";
import {
  UChatRuntimeProvider,
  useUChatRuntime,
  useUChatSelector,
} from "@/shared/uchat/ui";
import { useChatKnowledgeBaseState } from "./knowledgeBaseState";
import {
  DesktopChatAttachmentDriver,
  DesktopChatRepository,
  DesktopChatRunDriver,
} from "./protocol";
import {
  createDesktopThreadCreationPolicy,
  createDesktopComposerActions,
  desktopMessagePresentationHints,
  desktopSendLifecyclePolicy,
  desktopThreadSelectionPolicy,
} from "./runtimePolicies";

type ChatThreadDraftStateValue = {
  draftKnowledgeBaseId: string | null;
  setDraftKnowledgeBaseId: (knowledgeBaseId: string | null) => void;
  resetDraft: () => void;
};

const ChatThreadDraftStateContext =
  createContext<ChatThreadDraftStateValue | null>(null);

const desktopRuntimeBaseCapabilities = {
  renameThread: true,
  archiveThread: true,
  deleteThread: true,
  attachments: true,
  messagePresentation: desktopMessagePresentationHints,
} as const;

export const createStableAppChatRuntime = (
  getCreateThreadInput: () => { knowledgeBaseId?: string | null } | undefined,
) =>
  new ChatRuntime({
    repository: new DesktopChatRepository(getCreateThreadInput),
    runDriver: new DesktopChatRunDriver(),
    attachmentDriver: new DesktopChatAttachmentDriver(),
    policies: {
      threadCreation: createDesktopThreadCreationPolicy(),
      threadSelection: desktopThreadSelectionPolicy,
      sendLifecycle: desktopSendLifecyclePolicy,
      composerActions: createDesktopComposerActions({}),
      messagePresentation: desktopMessagePresentationHints,
    },
  });

// AppChatRuntimeProvider wires the protocol-agnostic runtime to the current
// desktop app adapters and exposes it through React context.
export function AppChatRuntimeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { knowledgeBases } = useChatKnowledgeBaseState();
  const [draftKnowledgeBaseId, setDraftKnowledgeBaseId] = useState<string | null>(
    null,
  );
  const draftKnowledgeBaseIdRef = useRef<string | null>(draftKnowledgeBaseId);
  draftKnowledgeBaseIdRef.current = draftKnowledgeBaseId;
  const runtimeRef = useRef<ChatRuntime | null>(null);

  if (!runtimeRef.current) {
    runtimeRef.current = createStableAppChatRuntime(() => ({
      knowledgeBaseId: draftKnowledgeBaseIdRef.current,
    }));
  }

  const runtime = runtimeRef.current;

  // Bootstrap the thread list once the provider mounts.
  useEffect(() => {
    void runtime.loadThreads();
  }, [runtime]);

  // Knowledge base availability affects only UI-facing composer actions. The
  // runtime instance must stay stable so thread state survives chat re-entry.
  useEffect(() => {
    runtime.setCapabilities({
      ...runtime.getState().capabilities,
      ...desktopRuntimeBaseCapabilities,
      composerActions: createDesktopComposerActions({
        knowledgeBases,
      }),
    });
  }, [knowledgeBases, runtime]);

  const draftState = useMemo<ChatThreadDraftStateValue>(
    () => ({
      draftKnowledgeBaseId,
      setDraftKnowledgeBaseId,
      resetDraft: () => setDraftKnowledgeBaseId(null),
    }),
    [draftKnowledgeBaseId],
  );

  return (
    <ChatThreadDraftStateContext.Provider value={draftState}>
      <UChatRuntimeProvider runtime={runtime}>{children}</UChatRuntimeProvider>
    </ChatThreadDraftStateContext.Provider>
  );
}

// useChatRuntime returns the bound app runtime instance.
export function useChatRuntime() {
  return useUChatRuntime();
}

// useChatRuntimeSelector re-exports the shared React selector helper with a
// feature-local name so existing chat code can migrate incrementally.
export function useChatRuntimeSelector<T>(
  selector: Parameters<typeof useUChatSelector<T>>[0],
) {
  return useUChatSelector(selector);
}

export function useChatThreadDraftState() {
  const context = useContext(ChatThreadDraftStateContext);
  if (!context) {
    throw new Error(
      "useChatThreadDraftState must be used within AppChatRuntimeProvider",
    );
  }

  return context;
}
