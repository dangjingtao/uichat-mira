// uchat only models domain concepts. It does not know any app-specific REST,
// SSE, or persistence protocol details.
export type ChatRole = "system" | "user" | "assistant";

// Message parts are the canonical, protocol-agnostic content units used inside
// the runtime. App-specific adapters translate to and from backend payloads.
export type ChatMessagePart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      source: string;
      mimeType?: string;
      name?: string;
      assetId?: string;
    }
  | {
      type: "file";
      source: string;
      mimeType: string;
      name: string;
      assetId?: string;
    }
  | {
      type: "data";
      name: string;
      value: unknown;
    };

// Run status represents the single assistant generation lifecycle in the
// runtime. activeRunThreadId identifies which thread owns a running task.
export type ChatRunStatus =
  | { type: "idle" }
  | { type: "running" }
  | { type: "cancelled" }
  | { type: "error"; message: string };

export type ChatMessageStatus =
  | "pending"
  | "streaming"
  | "complete"
  | "cancelled"
  | "error";

export type ChatToolTraceStatus =
  | "requested"
  | "running"
  | "succeeded"
  | "failed";

export interface ChatToolTraceEntry {
  toolCallId?: string;
  toolName: string;
  status: ChatToolTraceStatus;
  input?: Record<string, unknown>;
  output?: unknown;
  errorMessage?: string;
}

// ChatMessage is the runtime-owned canonical message model.
export interface ChatMessage {
  id: string;
  threadId: string;
  role: ChatRole;
  parts: ChatMessagePart[];
  createdAt: string;
  parentId: string | null;
  status: ChatMessageStatus;
  toolTrace?: ChatToolTraceEntry[];
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

// ChatThread is the runtime-owned canonical thread model.
export interface ChatThread {
  id: string;
  title: string;
  workspaceId?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  metadata?: Record<string, unknown>;
}

// ComposerAttachmentDraft tracks local file state before and during upload.
export interface ComposerAttachmentDraft {
  id: string;
  kind: "image" | "file";
  file: File;
  status: "idle" | "uploading" | "uploaded" | "error";
  uploadedPart?: Extract<ChatMessagePart, { type: "image" | "file" }>;
  errorMessage?: string;
}

// ChatComposerState stores the local draft input state.
export interface ChatComposerState {
  text: string;
  attachments: ComposerAttachmentDraft[];
}

export interface ChatComposerAction {
  id: string;
  kind: "attachment" | "command" | "menu";
  label: string;
  title?: string;
  disabled?: boolean;
  accept?: string;
  multiple?: boolean;
  attachmentKind?: "image" | "file";
  children?: ChatComposerAction[];
}

export interface ChatMessagePresentationHints {
  preferMarkdownForText?: boolean;
  assistantMaxWidth?: "compact" | "regular" | "wide";
  userMaxWidth?: "compact" | "regular" | "wide";
}

export interface ChatThreadContextTag {
  id: string;
  kind: "knowledge-base" | "role";
  label: string;
  tooltip?: string;
  removable?: boolean;
  avatarSrc?: string;
}

export interface ChatSidebarEntry {
  id: string;
  label: string;
  description?: string;
  badge?: string;
  disabled?: boolean;
}

// Capabilities let UI consumers hide actions the current app integration does
// not support, without teaching the core about any concrete UI framework.
export interface ChatRuntimeCapabilities {
  renameThread?: boolean;
  archiveThread?: boolean;
  deleteThread?: boolean;
  editMessage?: boolean;
  regenerate?: boolean;
  attachments?: boolean;
  agentEnabled?: boolean;
  composerActions?: ChatComposerAction[];
  sidebarEntries?: ChatSidebarEntry[];
  messagePresentation?: ChatMessagePresentationHints;
}

// ChatRuntimeState is the full runtime snapshot consumed by UI bindings.
export interface ChatRuntimeState {
  threads: ChatThread[];
  activeThreadId: string | null;
  composer: ChatComposerState;
  composerDrafts: Record<string, ChatComposerState>;
  threadListStatus: "idle" | "loading" | "ready" | "error";
  threadStatus: "idle" | "loading" | "ready" | "error";
  runStatus: ChatRunStatus;
  activeRunThreadId: string | null;
  hydratedThreadIds: string[];
  capabilities: ChatRuntimeCapabilities;
}

// ChatThreadSummary is the minimum list-view representation returned by a
// repository before a thread's full history is hydrated.
export interface ChatThreadSummary {
  id: string;
  title: string;
  workspaceId?: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ChatThreadCreationPolicy {
  findReusableThread?(state: ChatRuntimeState): string | null;
  buildCreateInput?(state: ChatRuntimeState): {
    title?: string;
    metadata?: Record<string, unknown>;
  } | undefined;
}

export interface ChatThreadSelectionPolicy {
  autoSelectAfterLoad?: "none" | "first";
  hydrateOnSelect?: boolean;
}

export interface ChatSendLifecyclePolicy {
  beforeSend?(input: {
    state: ChatRuntimeState;
    activeThread: ChatThread | null;
  }): Promise<void> | void;
  afterSendSuccess?(input: {
    thread: ChatThread;
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
  }): Promise<void> | void;
  afterSendError?(input: {
    thread: ChatThread;
    userMessage: ChatMessage;
    error: Error;
  }): Promise<void> | void;
}

// ChatRepository is the persistence boundary. App-specific code implements it
// against any HTTP API, local DB, SDK, or mock source.
export interface ChatRepository {
  listThreads(): Promise<ChatThreadSummary[]>;
  getThread(threadId: string): Promise<ChatThread>;
  createThread(input?: {
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ChatThread>;
  createMessage(
    threadId: string,
    input: {
      id?: string;
      role: ChatRole;
      content: string;
      parentId?: string | null;
      parts?: ChatMessagePart[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<ChatMessage>;
  updateThread?(
    threadId: string,
    input: {
      title?: string;
      workspaceId?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<ChatThread>;
  archiveThread?(threadId: string): Promise<void>;
  deleteThread?(threadId: string): Promise<void>;
}

// ChatRunEvent is the transport-agnostic event stream emitted by a run driver.
export type ChatRunEvent =
  | { type: "message:start"; messageId?: string }
  | { type: "message:part"; messageId?: string; part: ChatMessagePart }
  | { type: "message:replace"; messageId?: string; parts: ChatMessagePart[] }
  | {
      type: "message:tool";
      messageId?: string;
      toolCallId?: string;
      toolName: string;
      status: "requested" | "running" | "succeeded" | "failed";
      input?: Record<string, unknown>;
      output?: unknown;
      errorMessage?: string;
    }
  | {
      type: "message:metadata";
      messageId?: string;
      metadata: Record<string, unknown>;
    }
  | { type: "message:error"; messageId?: string; errorMessage: string }
  | { type: "message:finish"; messageId?: string }
  | { type: "run:error"; errorMessage: string }
  | { type: "run:finish" };

// ChatRunContext provides the driver with the current thread snapshot and the
// user message that triggered the run.
export interface ChatRunContext {
  thread: ChatThread;
  message: ChatMessage;
  history: ChatMessage[];
  signal?: AbortSignal;
  options?: {
    agentEnabled?: boolean;
    requestedToolGroupIds?: string[];
  };
}

// ChatRunDriver is the assistant execution boundary. It can be implemented by
// SSE, WebSocket, polling, local mocks, or any future transport.
export interface ChatRunDriver {
  run(
    context: ChatRunContext,
    onEvent: (event: ChatRunEvent) => void | Promise<void>,
  ): Promise<void>;
}

// ChatAttachmentDriver is the file upload boundary. The runtime only needs the
// resulting canonical message part, not the upload protocol itself.
export interface ChatAttachmentDriver {
  upload(file: File): Promise<Extract<ChatMessagePart, { type: "image" | "file" }>>;
}
