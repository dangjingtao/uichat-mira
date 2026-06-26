import type { ChatRuntimeStoreApi } from "./store";
import { createChatRuntimeStore } from "./store";
import type {
  ChatAttachmentDriver,
  ChatComposerAction,
  ChatMessage,
  ChatMessagePresentationHints,
  ChatMessagePart,
  ChatRepository,
  ChatRunDriver,
  ChatRuntimeCapabilities,
  ChatSendLifecyclePolicy,
  ChatToolTraceEntry,
  ChatThreadCreationPolicy,
  ChatThreadSelectionPolicy,
  ChatThread,
} from "./types";
import { buildOutgoingUserParts } from "./send-utils";

type ChatRuntimePolicies = {
  threadCreation?: ChatThreadCreationPolicy;
  threadSelection?: ChatThreadSelectionPolicy;
  sendLifecycle?: ChatSendLifecyclePolicy;
  composerActions?: ChatComposerAction[];
  messagePresentation?: ChatMessagePresentationHints;
};

// ChatRuntimeOptions wires the protocol-agnostic runtime to app-specific
// repository, run, and attachment implementations.
export type ChatRuntimeOptions = {
  repository: ChatRepository;
  runDriver: ChatRunDriver;
  attachmentDriver?: ChatAttachmentDriver;
  policies?: ChatRuntimePolicies;
  createId?: () => string;
  now?: () => string;
};

type SendOverrides = {
  history?: ChatMessage[];
  userMessageId?: string;
  assistantMessageId?: string;
  userParts?: ChatMessagePart[];
  assistantParts?: ChatMessagePart[];
  assistantParentId?: string | null;
  assistantMetadata?: Record<string, unknown>;
  skipUserAppend?: boolean;
};

// Metadata merging is shallow by design. App integrations can still nest and
// replace richer metadata payloads in their own drivers if needed.
const mergeMetadata = (
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
) => ({
  ...(base ?? {}),
  ...patch,
});

const mergeMessagePartsPreservingRuntimeData = (
  persistedParts: ChatMessagePart[],
  currentParts: ChatMessagePart[],
) => {
  const runtimeDataParts = currentParts.filter((part) => part.type === "data");
  if (runtimeDataParts.length === 0) {
    return persistedParts;
  }

  const persistedDataKeys = new Set(
    persistedParts
      .filter(
        (part): part is Extract<ChatMessagePart, { type: "data" }> =>
          part.type === "data",
      )
      .map((part) => `${part.name}:${JSON.stringify(part.value)}`),
  );

  const nextRuntimeDataParts = runtimeDataParts.filter(
    (part) => !persistedDataKeys.has(`${part.name}:${JSON.stringify(part.value)}`),
  );

  return nextRuntimeDataParts.length > 0
    ? [...persistedParts, ...nextRuntimeDataParts]
    : persistedParts;
};

const mergeThreadMessagesPreservingRuntimeState = (
  persistedThread: ChatThread,
  currentThread: ChatThread | null,
): ChatThread => {
  if (!currentThread || currentThread.messages.length === 0) {
    return persistedThread;
  }

  const remainingCurrentMessages = [...currentThread.messages];
  const mergedMessages = persistedThread.messages.map((persistedMessage, index) => {
    const byIdIndex = remainingCurrentMessages.findIndex(
      (message) => message.id === persistedMessage.id,
    );
    const fallbackIndex =
      byIdIndex >= 0
        ? byIdIndex
        : remainingCurrentMessages.findIndex(
            (message) =>
              message.role === persistedMessage.role &&
              message.parentId === persistedMessage.parentId &&
              message.status !== "error",
          );
    const currentMessage =
      fallbackIndex >= 0 ? remainingCurrentMessages.splice(fallbackIndex, 1)[0] : null;

    if (!currentMessage) {
      return persistedMessage;
    }

    return {
      ...persistedMessage,
      parts: mergeMessagePartsPreservingRuntimeData(
        persistedMessage.parts,
        currentMessage.parts,
      ),
      toolTrace:
        persistedMessage.toolTrace && persistedMessage.toolTrace.length > 0
          ? persistedMessage.toolTrace
          : currentMessage.toolTrace,
      metadata:
        currentMessage.metadata || persistedMessage.metadata
          ? {
              ...(currentMessage.metadata ?? {}),
              ...(persistedMessage.metadata ?? {}),
            }
          : undefined,
      errorMessage:
        persistedMessage.errorMessage ?? currentMessage.errorMessage ?? undefined,
      status:
        persistedMessage.status === "complete" ? "complete" : currentMessage.status,
    };
  });

  const optimisticUserMessages =
    persistedThread.messages.length === 0
      ? remainingCurrentMessages.filter(
          (message) => message.role === "user" && message.status === "complete",
        )
      : [];
  const erroredRuntimeMessages = remainingCurrentMessages.filter(
    (message) => message.status === "error",
  );
  const latestPersistedMessage = persistedThread.messages.at(-1);
  const runtimeAssistantTail =
    latestPersistedMessage?.role === "user"
      ? remainingCurrentMessages.filter(
          (message) =>
            message.role === "assistant" &&
            message.status !== "error" &&
            message.parentId === latestPersistedMessage.id &&
            message.parts.length > 0,
        )
      : [];

  return {
    ...persistedThread,
    messages:
      optimisticUserMessages.length > 0 ||
      runtimeAssistantTail.length > 0 ||
      erroredRuntimeMessages.length > 0
        ? [
            ...mergedMessages,
            ...optimisticUserMessages,
            ...runtimeAssistantTail,
            ...erroredRuntimeMessages,
          ]
        : mergedMessages,
  };
};

const mergeToolTraceEntry = (
  current: ChatToolTraceEntry | undefined,
  next: ChatToolTraceEntry,
): ChatToolTraceEntry => ({
  ...(current ?? {}),
  ...next,
});

const upsertToolTrace = (
  currentTrace: ChatToolTraceEntry[] | undefined,
  nextEntry: ChatToolTraceEntry,
) => {
  const trace = currentTrace ?? [];
  const nextKey = `${nextEntry.toolCallId ?? ""}:${nextEntry.toolName}`;
  const index = trace.findIndex(
    (entry) => `${entry.toolCallId ?? ""}:${entry.toolName}` === nextKey,
  );

  if (index < 0) {
    return [...trace, nextEntry];
  }

  const nextTrace = [...trace];
  nextTrace[index] = mergeToolTraceEntry(nextTrace[index], nextEntry);
  return nextTrace;
};

// Runtime capabilities are derived once from the configured drivers so UI code
// can stay declarative and avoid probing repository internals.
const deriveCapabilities = (options: ChatRuntimeOptions): ChatRuntimeCapabilities => ({
  renameThread: typeof options.repository.updateThread === "function",
  archiveThread: typeof options.repository.archiveThread === "function",
  deleteThread: typeof options.repository.deleteThread === "function",
  editMessage: typeof options.repository.createMessage === "function",
  attachments: typeof options.attachmentDriver === "function"
    ? true
    : Boolean(options.attachmentDriver),
  composerActions: options.policies?.composerActions ?? [],
  messagePresentation: options.policies?.messagePresentation ?? {},
});

// ChatRuntime is the main uchat orchestration entry point. It owns state,
// thread hydration, composer lifecycle, uploads, and generation flow.
export class ChatRuntime {
  readonly store: ChatRuntimeStoreApi;
  readonly repository: ChatRepository;
  readonly runDriver: ChatRunDriver;
  readonly attachmentDriver?: ChatAttachmentDriver;
  readonly policies: ChatRuntimePolicies;
  readonly createId: () => string;
  readonly now: () => string;
  private currentRunController: AbortController | null = null;

  constructor(options: ChatRuntimeOptions) {
    this.store = createChatRuntimeStore();
    this.repository = options.repository;
    this.runDriver = options.runDriver;
    this.attachmentDriver = options.attachmentDriver;
    this.policies = options.policies ?? {};
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.now = options.now ?? (() => new Date().toISOString());
    this.store.getState().setCapabilities(deriveCapabilities(options));
  }

  // Updates UI-facing capabilities without recreating the runtime instance or
  // replacing the underlying store. App providers use this when surrounding
  // config such as available knowledge bases changes over time.
  setCapabilities(capabilities: ChatRuntimeCapabilities) {
    this.store.getState().setCapabilities(capabilities);
  }

  // Returns the current immutable runtime snapshot.
  getState() {
    return this.store.getState();
  }

  // Returns the active hydrated thread when available.
  getActiveThread() {
    const state = this.getState();
    return state.threads.find((thread) => thread.id === state.activeThreadId) ?? null;
  }

  // After a send finishes, the in-memory optimistic state should converge back
  // to the persisted backend truth so titles, message metadata, and failed runs
  // do not drift from what a refresh would show.
  private async reconcileThreadAfterSend(threadId: string) {
    await this.refreshThread(threadId);
    await this.loadThreads();
  }

  // Loads lightweight thread summaries for the sidebar or thread switcher.
  async loadThreads() {
    this.store.getState().setThreadListStatus("loading");
    try {
      const summaries = await this.repository.listThreads();
      const threads: ChatThread[] = summaries.map((thread) => ({
        ...thread,
        messages: [],
      }));
      this.store.getState().setThreads(threads);
      this.store.getState().setThreadListStatus("ready");

      const autoSelectAfterLoad =
        this.policies.threadSelection?.autoSelectAfterLoad ?? "first";
      if (
        autoSelectAfterLoad === "first" &&
        !this.getState().activeThreadId &&
        threads[0]
      ) {
        this.store.getState().setActiveThreadId(threads[0].id);
      }

      return threads;
    } catch (error) {
      this.store.getState().setThreadListStatus("error");
      throw error;
    }
  }

  // Ensures there is an active thread to send into. It either hydrates the
  // requested thread or creates a fresh one through the repository boundary.
  async ensureThread(threadId?: string | null) {
    if (threadId) {
      return this.selectThread(threadId);
    }

    const reusableThreadId =
      this.policies.threadCreation?.findReusableThread?.(this.getState()) ?? null;
    if (reusableThreadId) {
      return this.selectThread(reusableThreadId);
    }

    const createInput = this.policies.threadCreation?.buildCreateInput?.(
      this.getState(),
    );
    const created = await this.repository.createThread(createInput);
    this.store.getState().upsertThread(created);
    this.store.getState().setActiveThreadId(created.id);
    this.store.getState().markHydrated(created.id);
    return created;
  }

  // Hydrates a thread on first entry and reuses cached history afterwards.
  async selectThread(threadId: string) {
    this.store.getState().activateComposerForThread(threadId);

    const hydrateOnSelect = this.policies.threadSelection?.hydrateOnSelect ?? true;
    if (!hydrateOnSelect) {
      return this.getThread(threadId);
    }

    if (this.getState().hydratedThreadIds.includes(threadId)) {
      return this.getActiveThread();
    }

    this.store.getState().setThreadStatus("loading");
    try {
      const thread = await this.repository.getThread(threadId);
      this.store.getState().upsertThread(thread);
      this.store.getState().markHydrated(threadId);
      this.store.getState().setThreadStatus("ready");
      return thread;
    } catch (error) {
      this.store.getState().setThreadStatus("error");
      throw error;
    }
  }

  // Renaming is optional because some repositories may expose immutable thread
  // titles or generate them asynchronously.
  async renameThread(threadId: string, title: string) {
    if (!this.repository.updateThread) {
      return;
    }

    const updated = await this.repository.updateThread(threadId, { title });
    this.store.getState().upsertThread(updated);
  }

  // Refreshes one thread from the repository and replaces the hydrated copy in
  // the runtime store. UI code should prefer this over calling app APIs.
  async refreshThread(threadId: string) {
    const refreshed = await this.repository.getThread(threadId);
    const current = this.getThread(threadId);
    const merged = mergeThreadMessagesPreservingRuntimeState(refreshed, current);
    this.store.getState().upsertThread(merged);
    this.store.getState().markHydrated(threadId);
    return merged;
  }

  // Updates mutable thread fields through the repository boundary and keeps the
  // store in sync with the persisted result.
  async updateThread(
    threadId: string,
    input: {
      title?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    if (!this.repository.updateThread) {
      throw new Error("Thread updates are not supported by this repository");
    }

    const updated = await this.repository.updateThread(threadId, input);
    const current = this.getThread(threadId);
    const merged = current
      ? {
          ...current,
          title: updated.title,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
          metadata: updated.metadata,
        }
      : updated;

    this.store.getState().upsertThread(merged);
    if (current) {
      this.store.getState().markHydrated(threadId);
    }
    return merged;
  }

  // Archives a thread and removes it from the active in-memory list when the
  // repository exposes archival support.
  async archiveThread(threadId: string) {
    if (!this.repository.archiveThread) {
      throw new Error("Thread archive is not supported by this repository");
    }

    await this.repository.archiveThread(threadId);
    await this.loadThreads();
  }

  // Deletes a thread and refreshes the thread list so selection can move to a
  // surviving thread.
  async deleteThread(threadId: string) {
    if (!this.repository.deleteThread) {
      throw new Error("Thread deletion is not supported by this repository");
    }

    await this.repository.deleteThread(threadId);
    await this.loadThreads();
  }

  // Returns the UI to the pure welcome draft state without persisting any new
  // thread. The first subsequent send remains the only thread-creation point.
  enterWelcomeState() {
    this.store.getState().activateComposerForThread(null);
    this.store.getState().setThreadStatus("idle");
    this.store.getState().setRunStatus({ type: "idle" });
  }

  // Cancels the in-flight assistant run if the current transport supports AbortSignal.
  cancelSend() {
    if (!this.currentRunController) {
      return;
    }

    this.currentRunController.abort();
    this.currentRunController = null;
    this.store.getState().setRunStatus({ type: "cancelled" });
  }

  // Removes one message from the in-memory thread snapshot. This is used to
  // retract optimistic assistant placeholders when a send fails before any
  // persisted assistant content exists.
  removeMessage(threadId: string, messageId: string) {
    this.store.getState().removeMessage(threadId, messageId);
  }

  // Updates the local draft text without involving any external protocol.
  setComposerText(text: string) {
    this.store.getState().setComposerText(text);
  }

  // Replaces the local attachment draft list from a UI file selection.
  setComposerAttachments(attachments: File[]) {
    this.store.getState().setComposerAttachments(
      attachments.map((file) => ({
        id: this.createId(),
        kind: file.type.startsWith("image/") ? "image" : "file",
        file,
        status: "idle",
      })),
    );
  }

  // Appends new local attachment drafts without replacing the current list.
  appendComposerAttachments(attachments: File[]) {
    this.store.getState().appendComposerAttachments(
      attachments.map((file) => ({
        id: this.createId(),
        kind: file.type.startsWith("image/") ? "image" : "file",
        file,
        status: "idle",
      })),
    );
  }

  // Removes one local attachment draft before send. Uploaded-but-unsent
  // attachments currently stay server-side; explicit remote cleanup can be
  // added once the backend exposes attachment deletion.
  removeComposerAttachment(attachmentId: string) {
    this.store.getState().removeComposerAttachment(attachmentId);
  }

  // Uploads pending composer attachments through the attachment driver and
  // stores the resulting canonical message parts on the draft entries.
  private async uploadComposerAttachments() {
    if (!this.attachmentDriver) {
      return;
    }

    const attachments = this.getState().composer.attachments;
    const next = [...attachments];

    for (let index = 0; index < next.length; index += 1) {
      const attachment = next[index];
      if (!attachment || attachment.status === "uploaded") {
        continue;
      }

      next[index] = {
        ...attachment,
        status: "uploading",
      };
      this.store.getState().setComposerAttachments(next);

      try {
        const uploadedPart = await this.attachmentDriver.upload(attachment.file);
        next[index] = {
          ...attachment,
          status: "uploaded",
          uploadedPart,
        };
        this.store.getState().setComposerAttachments(next);
      } catch (error) {
        next[index] = {
          ...attachment,
          status: "error",
          errorMessage: error instanceof Error ? error.message : String(error),
        };
        this.store.getState().setComposerAttachments(next);
        throw error;
      }
    }
  }

  // Sends the current composer draft through the configured run driver.
  private async sendInternal(overrides: SendOverrides = {}) {
    await this.uploadComposerAttachments();
    const parts = overrides.userParts ?? buildOutgoingUserParts(this.getState().composer);
    if (parts.length === 0) {
      return;
    }

    const thread = await this.ensureThread(this.getState().activeThreadId);
    if (!thread) {
      throw new Error("No active thread");
    }

    await this.policies.sendLifecycle?.beforeSend?.({
      state: this.getState(),
      activeThread: thread,
    });

    const history = overrides.history ?? thread.messages;
    const currentUserMessageId = overrides.userMessageId ?? null;
    const historyAlreadyContainsCurrentUser =
      currentUserMessageId !== null &&
      history.at(-1)?.id === currentUserMessageId;
    const runHistory = historyAlreadyContainsCurrentUser
      ? history.slice(0, -1)
      : history;

    const createdAt = this.now();
    const userMessage: ChatMessage = {
      id: overrides.userMessageId ?? this.createId(),
      threadId: thread.id,
      role: "user",
      parts,
      createdAt,
      parentId: runHistory.at(-1)?.id ?? null,
      status: "complete",
    };

    const assistantMessageId = overrides.assistantMessageId ?? this.createId();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      threadId: thread.id,
      role: "assistant",
      parts: overrides.assistantParts ?? [],
      createdAt,
      parentId:
        overrides.assistantParentId !== undefined
          ? overrides.assistantParentId
          : userMessage.id,
      status: "streaming",
      ...(overrides.assistantMetadata
        ? { metadata: overrides.assistantMetadata }
        : {}),
    };

    const activeThread = {
      ...thread,
      messages: runHistory,
    };

    if (!overrides.skipUserAppend) {
      this.store.getState().appendMessage(thread.id, userMessage);
    }
    this.store.getState().appendMessage(thread.id, assistantMessage);
    this.store.getState().resetComposer();
    this.store.getState().setRunStatus({ type: "running" });

    this.currentRunController = new AbortController();
    try {
      let streamErrorMessage: string | null = null;
      await this.runDriver.run(
        {
          thread: activeThread,
          message: userMessage,
          history: activeThread.messages,
          signal: this.currentRunController.signal,
        },
        async (event) => {
          if (event.type === "message:part") {
            this.store
              .getState()
              .appendMessagePart(thread.id, assistantMessageId, event.part);
            return;
          }

          if (event.type === "message:replace") {
            const current = this.getMessage(thread.id, assistantMessageId);
            if (!current) {
              return;
            }

            this.store.getState().replaceMessage(thread.id, assistantMessageId, {
              ...current,
              parts: event.parts,
            });
            return;
          }

          if (event.type === "message:metadata") {
            const current = this.getMessage(thread.id, assistantMessageId);
            if (!current) {
              return;
            }

            this.store.getState().patchMessage(thread.id, assistantMessageId, {
              metadata: mergeMetadata(current.metadata, event.metadata),
            });
            return;
          }

          if (event.type === "message:tool") {
            const current = this.getMessage(thread.id, assistantMessageId);
            if (!current) {
              return;
            }
            this.store.getState().patchMessage(thread.id, assistantMessageId, {
              toolTrace: upsertToolTrace(current.toolTrace, {
                toolCallId: event.toolCallId,
                toolName: event.toolName,
                status: event.status,
                ...(event.input ? { input: event.input } : {}),
                ...(Object.prototype.hasOwnProperty.call(event, "output")
                  ? { output: event.output }
                  : {}),
                ...(event.errorMessage ? { errorMessage: event.errorMessage } : {}),
              }),
            });
            return;
          }

          if (event.type === "message:error") {
            streamErrorMessage = event.errorMessage;
            this.store.getState().patchMessage(thread.id, assistantMessageId, {
              status: "error",
              errorMessage: event.errorMessage,
            });
            return;
          }

          if (event.type === "message:finish") {
            if (streamErrorMessage) {
              return;
            }
            this.store.getState().patchMessage(thread.id, assistantMessageId, {
              status: "complete",
            });
            return;
          }

          if (event.type === "run:error") {
            streamErrorMessage = event.errorMessage;
            this.store.getState().setRunStatus({
              type: "error",
              message: event.errorMessage,
            });
            this.store.getState().patchMessage(thread.id, assistantMessageId, {
              status: "error",
              errorMessage: event.errorMessage,
            });
            return;
          }

          if (event.type === "run:finish") {
            if (streamErrorMessage) {
              return;
            }
            this.store.getState().setRunStatus({ type: "idle" });
          }
        },
      );
      if (streamErrorMessage) {
        const streamError = new Error(streamErrorMessage);
        await this.policies.sendLifecycle?.afterSendError?.({
          thread,
          userMessage,
          error: streamError,
        });
        try {
          await this.reconcileThreadAfterSend(thread.id);
        } catch {
          // Keep the streamed assistant error visible if backend refresh fails.
        }
        return;
      }
      this.store.getState().setRunStatus({ type: "idle" });

      const completedAssistantMessage = this.getMessage(thread.id, assistantMessageId);
      const completedThread = this.getThread(thread.id);
      if (completedAssistantMessage && completedThread) {
        await this.policies.sendLifecycle?.afterSendSuccess?.({
          thread: completedThread,
          userMessage,
          assistantMessage: completedAssistantMessage,
        });
      }

      await this.reconcileThreadAfterSend(thread.id);
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error("Failed to run chat");
      const isCancelled =
        this.currentRunController?.signal.aborted ||
        normalizedError.name === "AbortError";
      this.currentRunController = null;
      if (isCancelled) {
        this.store.getState().removeMessage(thread.id, assistantMessageId);
        this.store.getState().setRunStatus({ type: "cancelled" });
        try {
          await this.reconcileThreadAfterSend(thread.id);
        } catch {
          // keep local cancelled state if refresh fails
        }
        return;
      }
      const errorMessage = normalizedError.message;
      this.store.getState().setRunStatus({
        type: "error",
        message: errorMessage,
      });
      await this.policies.sendLifecycle?.afterSendError?.({
        thread,
        userMessage,
        error: normalizedError,
      });

      this.store.getState().removeMessage(thread.id, assistantMessageId);
      this.store.getState().patchMessage(thread.id, userMessage.id, {
        status: "complete",
      });

      try {
        await this.reconcileThreadAfterSend(thread.id);
      } catch {
        // Keep the original send failure as the surfaced error. Reconciliation
        // is best-effort and must not hide the transport error that triggered it.
      }
      throw error;
    } finally {
      this.currentRunController = null;
    }
  }

  async send() {
    await this.sendInternal();
  }

  async regenerate(messageId: string) {
    if (this.currentRunController) {
      throw new Error("A run is already in progress");
    }

    const thread = this.getActiveThread();
    if (!thread) {
      throw new Error("No active thread");
    }

    const index = thread.messages.findIndex((message) => message.id === messageId);
    if (index < 0) {
      throw new Error("Message not found");
    }

    const targetMessage = thread.messages[index];
    if (!targetMessage || targetMessage.role !== "assistant") {
      throw new Error("Regenerate target must be an assistant message");
    }

    const userIndex = [...thread.messages]
      .slice(0, index)
      .map((message, messageIndex) => ({ message, messageIndex }))
      .reverse()
      .find((entry) => entry.message.role === "user")?.messageIndex;

    if (userIndex === undefined) {
      throw new Error("Unable to locate the parent user message");
    }

    const userMessage = thread.messages[userIndex];
    if (!userMessage) {
      throw new Error("Parent user message not found");
    }

    const nextHistory = thread.messages.slice(0, userIndex + 1);
    this.store.getState().upsertThread({
      ...thread,
      messages: nextHistory,
    });

    const userParts = userMessage.parts;
    await this.sendInternal({
      history: nextHistory,
      userMessageId: userMessage.id,
      userParts,
      skipUserAppend: true,
    });
  }

  async editUserMessage(
    messageId: string,
    text: string,
    parts?: ChatMessagePart[],
  ) {
    if (this.currentRunController) {
      throw new Error("A run is already in progress");
    }

    const thread = this.getActiveThread();
    if (!thread) {
      throw new Error("No active thread");
    }

    const index = thread.messages.findIndex((message) => message.id === messageId);
    if (index < 0) {
      throw new Error("Message not found");
    }

    const targetMessage = thread.messages[index];
    if (!targetMessage || targetMessage.role !== "user") {
      throw new Error("Edit target must be a user message");
    }

    const nextHistory = thread.messages.slice(0, index + 1);
    const nextUserParts =
      parts && parts.length > 0
        ? parts
        : [{ type: "text", text } satisfies ChatMessagePart];
    const nextContent =
      nextUserParts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim() || text;
    const updatedTargetMessage: ChatMessage = {
      ...targetMessage,
      parts: nextUserParts,
    };
    const nextLocalHistory = [
      ...thread.messages.slice(0, index),
      updatedTargetMessage,
    ];

    this.store.getState().upsertThread({
      ...thread,
      messages: nextLocalHistory,
    });

    await this.repository.createMessage(thread.id, {
      id: targetMessage.id,
      role: "user",
      content: nextContent,
      parentId: targetMessage.parentId,
      parts: nextUserParts,
      metadata: targetMessage.metadata,
    });

    await this.sendInternal({
      history: nextLocalHistory,
      userMessageId: targetMessage.id,
      userParts: nextUserParts,
      skipUserAppend: true,
    });
  }

  // Reads a thread from the current store snapshot.
  getThread(threadId: string) {
    return this.getState().threads.find((thread) => thread.id === threadId) ?? null;
  }

  // Reads a message from the current store snapshot.
  getMessage(threadId: string, messageId: string) {
    return (
      this.getThread(threadId)?.messages.find((message) => message.id === messageId) ??
      null
    );
  }
}
