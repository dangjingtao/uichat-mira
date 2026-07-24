import { createStore, type StoreApi } from "zustand/vanilla";
import type {
  ChatComposerState,
  ChatMessage,
  ChatMessagePart,
  ChatRuntimeCapabilities,
  ChatRuntimeState,
  ChatThread,
  ComposerAttachmentDraft,
} from "./types";

// Store actions keep state mutations centralized so UI bindings and runtime
// commands both operate on the same predictable update surface.
type ChatRuntimeActions = {
  setThreads: (threads: ChatThread[]) => void;
  upsertThread: (thread: ChatThread) => void;
  setActiveThreadId: (threadId: string | null) => void;
  activateComposerForThread: (threadId: string | null) => void;
  setThreadListStatus: (status: ChatRuntimeState["threadListStatus"]) => void;
  setThreadStatus: (status: ChatRuntimeState["threadStatus"]) => void;
  setRunStatus: (
    status: ChatRuntimeState["runStatus"],
    activeRunThreadId?: string | null,
  ) => void;
  setComposerText: (text: string) => void;
  setComposerTextForThread: (threadId: string | null, text: string) => void;
  resetComposer: () => void;
  resetComposerForThread: (threadId: string | null) => void;
  setComposerAttachments: (attachments: ComposerAttachmentDraft[]) => void;
  setComposerAttachmentsForThread: (
    threadId: string | null,
    attachments: ComposerAttachmentDraft[],
  ) => void;
  appendComposerAttachments: (attachments: ComposerAttachmentDraft[]) => void;
  removeComposerAttachment: (attachmentId: string) => void;
  appendMessage: (threadId: string, message: ChatMessage) => void;
  removeMessage: (threadId: string, messageId: string) => void;
  replaceMessage: (threadId: string, messageId: string, next: ChatMessage) => void;
  patchMessage: (
    threadId: string,
    messageId: string,
    patch: Partial<ChatMessage>,
  ) => void;
  appendMessagePart: (
    threadId: string,
    messageId: string,
    part: ChatMessagePart,
  ) => void;
  setHydratedThreadIds: (threadIds: string[]) => void;
  markHydrated: (threadId: string) => void;
  setCapabilities: (capabilities: ChatRuntimeCapabilities) => void;
};

export type ChatRuntimeStore = ChatRuntimeState & ChatRuntimeActions;

// The composer resets to a clean draft after a successful send.
const initialComposerState: ChatComposerState = {
  text: "",
  attachments: [],
};

// This is the protocol-agnostic initial runtime snapshot used by uchat.
const initialState: ChatRuntimeState = {
  threads: [],
  activeThreadId: null,
  composer: initialComposerState,
  composerDrafts: {},
  threadListStatus: "idle",
  threadStatus: "idle",
  runStatus: { type: "idle" },
  activeRunThreadId: null,
  hydratedThreadIds: [],
  capabilities: {
    attachments: true,
    composerActions: [],
    messagePresentation: {},
  },
};

const composerDraftKey = (threadId: string | null) => threadId ?? "__welcome__";

const cloneComposerState = (composer: ChatComposerState): ChatComposerState => ({
  text: composer.text,
  attachments: [...composer.attachments],
});

const getComposerDraft = (
  state: ChatRuntimeState,
  threadId: string | null,
): ChatComposerState =>
  state.composerDrafts[composerDraftKey(threadId)] ?? initialComposerState;

const projectActiveComposer = (
  state: ChatRuntimeState,
  threadId: string | null,
) => cloneComposerState(getComposerDraft(state, threadId));

const setScopedComposerDraft = (
  state: ChatRuntimeState,
  threadId: string | null,
  draft: ChatComposerState,
) => {
  const key = composerDraftKey(threadId);
  const nextDraft = cloneComposerState(draft);
  return {
    composerDrafts: {
      ...state.composerDrafts,
      [key]: nextDraft,
    },
    ...(state.activeThreadId === threadId
      ? { composer: cloneComposerState(nextDraft) }
      : {}),
  };
};

// createChatRuntimeStore exposes a framework-neutral Zustand vanilla store so
// React is optional at the core layer.
export const createChatRuntimeStore = () =>
  createStore<ChatRuntimeStore>()((set) => ({
    ...initialState,
    setThreads: (threads) =>
      set((state) => ({
        threads: threads.map((thread) => {
          const existing = state.threads.find((item) => item.id === thread.id);
          if (!existing) {
            return thread;
          }

          const shouldPreserveHydratedMessages =
            state.hydratedThreadIds.includes(thread.id) && existing.messages.length > 0;

          return shouldPreserveHydratedMessages
            ? {
                ...thread,
                messages: existing.messages,
              }
            : thread;
        }),
      })),
    upsertThread: (thread) =>
      set((state) => {
        const index = state.threads.findIndex((item) => item.id === thread.id);
        if (index < 0) {
          return { threads: [thread, ...state.threads] };
        }

        const nextThreads = [...state.threads];
        nextThreads[index] = thread;
        return { threads: nextThreads };
      }),
    setActiveThreadId: (activeThreadId) =>
      set((state) => ({
        activeThreadId,
        composer: projectActiveComposer(state, activeThreadId),
      })),
    activateComposerForThread: (threadId) =>
      set((state) => {
        return {
          activeThreadId: threadId,
          composer: projectActiveComposer(state, threadId),
        };
      }),
    setThreadListStatus: (threadListStatus) => set({ threadListStatus }),
    setThreadStatus: (threadStatus) => set({ threadStatus }),
    setRunStatus: (runStatus, activeRunThreadId = null) =>
      set({
        runStatus,
        activeRunThreadId:
          runStatus.type === "running" ? activeRunThreadId : null,
      }),
    setComposerText: (text) =>
      set((state) => ({
        ...setScopedComposerDraft(state, state.activeThreadId, {
          ...getComposerDraft(state, state.activeThreadId),
          text,
        }),
      })),
    setComposerTextForThread: (threadId, text) =>
      set((state) => ({
        ...setScopedComposerDraft(state, threadId, {
          ...getComposerDraft(state, threadId),
          text,
        }),
      })),
    resetComposer: () =>
      set((state) => ({
        ...setScopedComposerDraft(
          state,
          state.activeThreadId,
          initialComposerState,
        ),
      })),
    resetComposerForThread: (threadId) =>
      set((state) => ({
        ...setScopedComposerDraft(state, threadId, initialComposerState),
      })),
    setComposerAttachments: (attachments) =>
      set((state) => ({
        ...setScopedComposerDraft(state, state.activeThreadId, {
          ...getComposerDraft(state, state.activeThreadId),
          attachments,
        }),
      })),
    setComposerAttachmentsForThread: (threadId, attachments) =>
      set((state) => ({
        ...setScopedComposerDraft(state, threadId, {
          ...getComposerDraft(state, threadId),
          attachments,
        }),
      })),
    appendComposerAttachments: (attachments) =>
      set((state) => {
        const current = getComposerDraft(state, state.activeThreadId);
        return {
          ...setScopedComposerDraft(state, state.activeThreadId, {
            ...current,
            attachments: [...current.attachments, ...attachments],
          }),
        };
      }),
    removeComposerAttachment: (attachmentId) =>
      set((state) => {
        const current = getComposerDraft(state, state.activeThreadId);
        return {
          ...setScopedComposerDraft(state, state.activeThreadId, {
            ...current,
            attachments: current.attachments.filter(
              (attachment) => attachment.id !== attachmentId,
            ),
          }),
        };
      }),
    appendMessage: (threadId, message) =>
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                updatedAt: message.createdAt,
                messages: [...thread.messages, message],
              }
            : thread,
        ),
      })),
    removeMessage: (threadId, messageId) =>
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: thread.messages.filter(
                  (message) => message.id !== messageId,
                ),
              }
            : thread,
        ),
      })),
    replaceMessage: (threadId, messageId, next) =>
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: thread.messages.map((message) =>
                  message.id === messageId ? next : message,
                ),
              }
            : thread,
        ),
      })),
    patchMessage: (threadId, messageId, patch) =>
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: thread.messages.map((message) =>
                  message.id === messageId ? { ...message, ...patch } : message,
                ),
              }
            : thread,
        ),
      })),
    appendMessagePart: (threadId, messageId, part) =>
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: thread.messages.map((message) =>
                  message.id === messageId
                    ? { ...message, parts: [...message.parts, part] }
                    : message,
                ),
              }
            : thread,
        ),
      })),
    setHydratedThreadIds: (threadIds) => set({ hydratedThreadIds: threadIds }),
    markHydrated: (threadId) =>
      set((state) => ({
        hydratedThreadIds: state.hydratedThreadIds.includes(threadId)
          ? state.hydratedThreadIds
          : [...state.hydratedThreadIds, threadId],
      })),
    setCapabilities: (capabilities) => set({ capabilities }),
  }));

export type ChatRuntimeStoreApi = StoreApi<ChatRuntimeStore>;
