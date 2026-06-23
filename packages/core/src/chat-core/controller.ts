import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla";
import type {
  ChatEngineRepositoryBundle,
  ChatMessageRecord,
  ChatMessageRole,
  ChatRequestBody,
  ChatStreamEvent,
  ChatThreadRecord,
  RuntimeMessageLike,
} from "./types";
import { ChatEngine } from "./ChatEngine";
import { parseChatStream } from "./stream";

export type ChatControllerState = {
  threads: ChatThreadRecord[];
  activeThreadId: string | null;
  loadingThreads: boolean;
  loadingThread: boolean;
  sending: boolean;
  errorText: string | null;
};

export type ChatControllerActions = {
  setThreads: (threads: ChatThreadRecord[]) => void;
  setActiveThreadId: (threadId: string | null) => void;
  upsertThread: (thread: ChatThreadRecord) => void;
  setThreadMessages: (
    threadId: string,
    messages: ChatMessageRecord[],
  ) => void;
  appendMessage: (threadId: string, message: ChatMessageRecord) => void;
  patchMessage: (
    threadId: string,
    messageId: string,
    patch: Partial<ChatMessageRecord>,
  ) => void;
  setLoadingThreads: (loading: boolean) => void;
  setLoadingThread: (loading: boolean) => void;
  setSending: (sending: boolean) => void;
  setErrorText: (errorText: string | null) => void;
};

export type ChatControllerStore = ChatControllerState & ChatControllerActions;

export type CreateChatControllerOptions = {
  repositories?: Partial<ChatEngineRepositoryBundle>;
  engine?: ChatEngine;
  streamTransport?: {
    send(input: ChatRequestBody): Promise<ReadableStream<Uint8Array>>;
  };
};

const createInitialState = (): ChatControllerState => ({
  threads: [],
  activeThreadId: null,
  loadingThreads: false,
  loadingThread: false,
  sending: false,
  errorText: null,
});

const createChatControllerState: StateCreator<ChatControllerStore> = (set) => ({
    ...createInitialState(),
    setThreads: (threads) => set({ threads }),
    setActiveThreadId: (activeThreadId) => set({ activeThreadId }),
    upsertThread: (thread) =>
      set((state) => {
        const existingIndex = state.threads.findIndex(
          (entry) => entry.id === thread.id,
        );

        if (existingIndex < 0) {
          return { threads: [thread, ...state.threads] };
        }

        const nextThreads = [...state.threads];
        nextThreads[existingIndex] = thread;
        return { threads: nextThreads };
      }),
    setThreadMessages: (threadId, messages) =>
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId ? { ...thread, messages } : thread,
        ),
      })),
    appendMessage: (threadId, message) =>
      set((state) => ({
        threads: state.threads.map((thread) =>
          thread.id === threadId
            ? { ...thread, messages: [...thread.messages, message] }
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
    setLoadingThreads: (loadingThreads) => set({ loadingThreads }),
    setLoadingThread: (loadingThread) => set({ loadingThread }),
    setSending: (sending) => set({ sending }),
    setErrorText: (errorText) => set({ errorText }),
  });

export const createChatControllerStore = () =>
  createStore<ChatControllerStore>()(createChatControllerState);

export class ChatController {
  readonly store: StoreApi<ChatControllerStore>;
  readonly repositories?: Partial<ChatEngineRepositoryBundle>;
  readonly engine: ChatEngine;
  readonly streamTransport?: {
    send(input: ChatRequestBody): Promise<ReadableStream<Uint8Array>>;
  };

  constructor(options: CreateChatControllerOptions = {}) {
    this.store = createChatControllerStore();
    this.repositories = options.repositories;
    this.engine = options.engine ?? new ChatEngine();
    this.streamTransport = options.streamTransport;
  }

  getState() {
    return this.store.getState();
  }

  subscribe(listener: Parameters<StoreApi<ChatControllerStore>["subscribe"]>[0]) {
    return this.store.subscribe(listener);
  }

  getActiveThread() {
    const state = this.getState();
    return state.threads.find((thread) => thread.id === state.activeThreadId) ?? null;
  }

  getThreadById(threadId: string) {
    return this.getState().threads.find((thread) => thread.id === threadId) ?? null;
  }

  createMessage(input: {
    role: ChatMessageRole;
    parts: ChatMessageRecord["parts"];
    parentId?: string | null;
    metadata?: Record<string, unknown>;
    status?: ChatMessageRecord["status"];
    errorText?: string;
    createdAt?: string;
    id?: string;
  }): ChatMessageRecord {
    return {
      id: input.id ?? crypto.randomUUID(),
      role: input.role,
      parts: input.parts,
      parentId:
        input.parentId === undefined ? null : input.parentId,
      metadata: input.metadata,
      status: input.status ?? "complete",
      errorText: input.errorText,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
  }

  async loadThreads() {
    if (!this.repositories?.threads?.list) {
      return [];
    }

    this.store.getState().setLoadingThreads(true);
    this.store.getState().setErrorText(null);

    try {
      const threads = await this.repositories.threads.list();
      this.store.getState().setThreads(threads as ChatThreadRecord[]);
      return threads as ChatThreadRecord[];
    } catch (error) {
      this.store
        .getState()
        .setErrorText(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.store.getState().setLoadingThreads(false);
    }
  }

  async selectThread(threadId: string) {
    this.store.getState().setActiveThreadId(threadId);

    if (!this.repositories?.threads?.getById) {
      return this.getThreadById(threadId);
    }

    this.store.getState().setLoadingThread(true);
    this.store.getState().setErrorText(null);

    try {
      const thread = (await this.repositories.threads.getById(
        threadId,
      )) as ChatThreadRecord;
      this.store.getState().upsertThread(thread);
      return thread;
    } catch (error) {
      this.store
        .getState()
        .setErrorText(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      this.store.getState().setLoadingThread(false);
    }
  }

  async sendMessage(input: {
    threadId: string;
    messages: readonly RuntimeMessageLike[];
    body?: Record<string, unknown>;
    historyPolicy?: "latest-user-attachments" | "none";
    assistantMessageId?: string;
    onEvent?: (event: ChatStreamEvent) => void | Promise<void>;
  }) {
    if (!this.streamTransport) {
      throw new Error("Chat stream transport is not configured");
    }

    const requestBody = this.engine.createRequestBody({
      messages: input.messages,
      threadId: input.threadId,
      body: input.body,
      historyPolicy: input.historyPolicy,
    });

    const assistantMessageId = input.assistantMessageId ?? crypto.randomUUID();
    const assistantMessage = this.createMessage({
      id: assistantMessageId,
      role: "assistant",
      parts: [],
      status: "streaming",
      parentId:
        typeof requestBody.messageId === "string" ? requestBody.messageId : null,
    });

    this.store.getState().appendMessage(input.threadId, assistantMessage);
    this.store.getState().setSending(true);
    this.store.getState().setErrorText(null);

    try {
      const stream = await this.streamTransport.send(requestBody);

      await parseChatStream(stream, async (event) => {
        await input.onEvent?.(event);

        if (event.type === "text-delta") {
          const current = this.getThreadById(input.threadId)?.messages.find(
            (message) => message.id === assistantMessageId,
          );
          const nextText = event.delta;
          const textParts = current?.parts.filter(
            (part) => part.type === "text",
          ) ?? [];
          const existingText = textParts[0]?.text ?? "";
          const nextParts = [
            { type: "text" as const, text: `${existingText}${nextText}` },
            ...(current?.parts.filter((part) => part.type !== "text") ?? []),
          ];

          this.store
            .getState()
            .patchMessage(input.threadId, assistantMessageId, {
              parts: nextParts,
            });
          return;
        }

        if (event.type === "data-rag-sources") {
          const current = this.getThreadById(input.threadId)?.messages.find(
            (message) => message.id === assistantMessageId,
          );
          const currentRag =
            current?.metadata?.rag &&
            typeof current.metadata.rag === "object" &&
            !Array.isArray(current.metadata.rag)
              ? (current.metadata.rag as Record<string, unknown>)
              : {};
          this.store
            .getState()
            .patchMessage(input.threadId, assistantMessageId, {
              metadata: {
                ...(current?.metadata ?? {}),
                rag: {
                  ...currentRag,
                  sources: event.data,
                },
              },
            });
          return;
        }

        if (event.type === "error") {
          // The catch-all stream event union keeps unknown payload keys, so we
          // normalize the error text before patching strongly-typed message state.
          const errorText =
            typeof event.errorText === "string"
              ? event.errorText
              : "Unknown stream error";
          this.store
            .getState()
            .patchMessage(input.threadId, assistantMessageId, {
              status: "error",
              errorText,
            });
          return;
        }

        if (event.type === "finish") {
          this.store
            .getState()
            .patchMessage(input.threadId, assistantMessageId, {
              status: event.finishReason === "stop" ? "complete" : "error",
            });
        }
      });
    } finally {
      this.store.getState().setSending(false);
    }
  }
}
