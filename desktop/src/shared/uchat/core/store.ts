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
  setRunStatus: (status: ChatRuntimeState["runStatus"]) => void;
  setComposerText: (text: string) => void;
  resetComposer: () => void;
  setComposerAttachments: (attachments: ComposerAttachmentDraft[]) => void;
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
    setActiveThreadId: (activeThreadId) => set({ activeThreadId }),
    activateComposerForThread: (threadId) =>
      set((state) => {
        const currentKey = composerDraftKey(state.activeThreadId);
        const nextKey = composerDraftKey(threadId);
        const nextDrafts = {
          ...state.composerDrafts,
          [currentKey]: cloneComposerState(state.composer),
        };

        return {
          activeThreadId: threadId,
          composerDrafts: nextDrafts,
          composer: cloneComposerState(
            nextDrafts[nextKey] ?? initialComposerState,
          ),
        };
      }),
    setThreadListStatus: (threadListStatus) => set({ threadListStatus }),
    setThreadStatus: (threadStatus) => set({ threadStatus }),
    setRunStatus: (runStatus) => set({ runStatus }),
    setComposerText: (text) =>
      set((state) => ({
        composer: {
          ...state.composer,
          text,
        },
        composerDrafts: {
          ...state.composerDrafts,
          [composerDraftKey(state.activeThreadId)]: {
            ...state.composer,
            text,
          },
        },
      })),
    resetComposer: () =>
      set((state) => ({
        composer: initialComposerState,
        composerDrafts: {
          ...state.composerDrafts,
          [composerDraftKey(state.activeThreadId)]: initialComposerState,
        },
      })),
    setComposerAttachments: (attachments) =>
      set((state) => ({
        composer: {
          ...state.composer,
          attachments,
        },
        composerDrafts: {
          ...state.composerDrafts,
          [composerDraftKey(state.activeThreadId)]: {
            ...state.composer,
            attachments,
          },
        },
      })),
    appendComposerAttachments: (attachments) =>
      set((state) => ({
        composer: {
          ...state.composer,
          attachments: [...state.composer.attachments, ...attachments],
        },
        composerDrafts: {
          ...state.composerDrafts,
          [composerDraftKey(state.activeThreadId)]: {
            ...state.composer,
            attachments: [...state.composer.attachments, ...attachments],
          },
        },
      })),
    removeComposerAttachment: (attachmentId) =>
      set((state) => ({
        composer: {
          ...state.composer,
          attachments: state.composer.attachments.filter(
              (attachment) => attachment.id !== attachmentId,
          ),
        },
        composerDrafts: {
          ...state.composerDrafts,
          [composerDraftKey(state.activeThreadId)]: {
            ...state.composer,
            attachments: state.composer.attachments.filter(
              (attachment) => attachment.id !== attachmentId,
            ),
          },
        },
      })),
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
