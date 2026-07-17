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
import {
  AGENT_RUN_UPDATED_EVENT,
  type AgentRunUpdatedEventDetail,
} from "@/shared/api/thread";
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
import { createChatMediaLifecyclePolicy } from "../adapters/chatMediaOrchestration";

type ChatThreadDraftStateValue = {
  draftKnowledgeBaseId: string | null;
  draftRoleId: string | null;
  draftAgentEnabled: boolean;
  draftTtsEnabled: boolean;
  draftImageEnabled: boolean;
  draftWorkspaceId: string | null;
  setDraftKnowledgeBaseId: (knowledgeBaseId: string | null) => void;
  setDraftRoleId: (roleId: string | null) => void;
  setDraftAgentEnabled: (enabled: boolean) => void;
  setDraftTtsEnabled: (enabled: boolean) => void;
  setDraftImageEnabled: (enabled: boolean) => void;
  setDraftWorkspaceId: (workspaceId: string | null) => void;
  resetDraft: () => void;
};

const ChatThreadDraftStateContext =
  createContext<ChatThreadDraftStateValue | null>(null);

const ACTIVE_THREAD_STORAGE_KEY = "rag-demo-chat-active-thread-id";

const desktopRuntimeBaseCapabilities = {
  renameThread: true,
  archiveThread: true,
  deleteThread: true,
  attachments: true,
  messagePresentation: desktopMessagePresentationHints,
} as const;

export const createStableAppChatRuntime = (
  getCreateThreadInput: () =>
        | {
          workspaceId?: string | null;
          knowledgeBaseId?: string | null;
          roleId?: string | null;
          agentEnabled?: boolean | null;
          ttsEnabled?: boolean | null;
          imageEnabled?: boolean | null;
        }
    | undefined,
) =>
  new ChatRuntime({
    repository: new DesktopChatRepository(getCreateThreadInput),
    runDriver: new DesktopChatRunDriver(),
    attachmentDriver: new DesktopChatAttachmentDriver(),
    policies: {
      threadCreation: createDesktopThreadCreationPolicy(getCreateThreadInput),
      threadSelection: desktopThreadSelectionPolicy,
      sendLifecycle: createChatMediaLifecyclePolicy(desktopSendLifecyclePolicy),
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
  const [draftRoleId, setDraftRoleId] = useState<string | null>(null);
  const [draftAgentEnabled, setDraftAgentEnabled] = useState(false);
  const [draftTtsEnabled, setDraftTtsEnabled] = useState(false);
  const [draftImageEnabled, setDraftImageEnabled] = useState(false);
  const [draftWorkspaceId, setDraftWorkspaceId] = useState<string | null>(null);
  const draftWorkspaceIdRef = useRef<string | null>(draftWorkspaceId);
  const draftKnowledgeBaseIdRef = useRef<string | null>(draftKnowledgeBaseId);
  const draftRoleIdRef = useRef<string | null>(draftRoleId);
  const draftAgentEnabledRef = useRef<boolean>(draftAgentEnabled);
  const draftTtsEnabledRef = useRef<boolean>(draftTtsEnabled);
  const draftImageEnabledRef = useRef<boolean>(draftImageEnabled);
  const hasBootstrappedActiveThreadRef = useRef(false);
  draftWorkspaceIdRef.current = draftWorkspaceId;
  draftKnowledgeBaseIdRef.current = draftKnowledgeBaseId;
  draftRoleIdRef.current = draftRoleId;
  draftAgentEnabledRef.current = draftAgentEnabled;
  draftTtsEnabledRef.current = draftTtsEnabled;
  draftImageEnabledRef.current = draftImageEnabled;
  const runtimeRef = useRef<ChatRuntime | null>(null);

  if (!runtimeRef.current) {
    runtimeRef.current = createStableAppChatRuntime(() => ({
      workspaceId: draftWorkspaceIdRef.current,
      knowledgeBaseId: draftKnowledgeBaseIdRef.current,
      roleId: draftRoleIdRef.current,
      agentEnabled: draftAgentEnabledRef.current,
      ttsEnabled: draftTtsEnabledRef.current,
      imageEnabled: draftImageEnabledRef.current,
    }));
  }

  const runtime = runtimeRef.current;

  // Persist only the currently selected persisted thread id. Refresh should
  // restore the active thread surface, including role / KB request context,
  // but welcome draft state remains ephemeral by design.
  useEffect(() => {
    return runtime.store.subscribe((state) => {
      if (!hasBootstrappedActiveThreadRef.current) {
        return;
      }

      if (state.activeThreadId) {
        globalThis.localStorage.setItem(
          ACTIVE_THREAD_STORAGE_KEY,
          state.activeThreadId,
        );
        return;
      }

      globalThis.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
    });
  }, [runtime]);

  // Bootstrap the thread list once the provider mounts.
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const persistedActiveThreadId = globalThis.localStorage.getItem(
        ACTIVE_THREAD_STORAGE_KEY,
      );
      const threads = await runtime.loadThreads();
      if (cancelled) {
        return;
      }
      if (!persistedActiveThreadId) {
        hasBootstrappedActiveThreadRef.current = true;
        return;
      }

      if (!threads.some((thread) => thread.id === persistedActiveThreadId)) {
        globalThis.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
        hasBootstrappedActiveThreadRef.current = true;
        return;
      }

      await runtime.selectThread(persistedActiveThreadId);
      hasBootstrappedActiveThreadRef.current = true;
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [runtime]);

  useEffect(() => {
    const handleThreadsCleaned = () => {
      void runtime.loadThreads().then(() => {
        if (!runtime.getState().activeThreadId) {
          runtime.enterWelcomeState();
        }
      });
    };

    window.addEventListener("uichat:threads-cleaned", handleThreadsCleaned);
    return () => {
      window.removeEventListener("uichat:threads-cleaned", handleThreadsCleaned);
    };
  }, [runtime]);

  useEffect(() => {
    let refreshChain = Promise.resolve();

    const handleAgentRunUpdated = (event: Event) => {
      const run = (event as CustomEvent<AgentRunUpdatedEventDetail>).detail?.run;
      if (!run?.threadId) {
        return;
      }

      refreshChain = refreshChain
        .then(async () => {
          await runtime.refreshThread(run.threadId);
          if (run.status !== "queued" && run.status !== "running") {
            await runtime.loadThreads();
          }
        })
        .catch(() => undefined);
    };

    window.addEventListener(AGENT_RUN_UPDATED_EVENT, handleAgentRunUpdated);
    return () => {
      window.removeEventListener(AGENT_RUN_UPDATED_EVENT, handleAgentRunUpdated);
    };
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
      draftRoleId,
      draftAgentEnabled,
      draftTtsEnabled,
      draftImageEnabled,
      draftWorkspaceId,
      setDraftKnowledgeBaseId,
      setDraftRoleId,
      setDraftAgentEnabled,
      setDraftTtsEnabled,
      setDraftImageEnabled,
      setDraftWorkspaceId,
      resetDraft: () => {
        setDraftWorkspaceId(null);
        setDraftKnowledgeBaseId(null);
        setDraftRoleId(null);
        setDraftAgentEnabled(false);
        setDraftTtsEnabled(false);
        setDraftImageEnabled(false);
      },
    }),
    [draftAgentEnabled, draftImageEnabled, draftKnowledgeBaseId, draftRoleId, draftTtsEnabled, draftWorkspaceId],
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
