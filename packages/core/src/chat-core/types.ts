export type ChatMessageRole = "system" | "user" | "assistant";

export type ChatTextPart = {
  type: "text";
  text: string;
};

export type ChatImagePart = {
  type: "image";
  image: string;
  filename?: string;
  fileId?: string;
  mediaType?: string;
};

export type ChatFilePart = {
  type: "file";
  data: string;
  filename: string;
  fileId?: string;
  mimeType: string;
};

export type ChatMessagePart = ChatTextPart | ChatImagePart | ChatFilePart;

export type ChatMessage = {
  id?: string;
  role: ChatMessageRole;
  parts: ChatMessagePart[];
};

export type ChatMessageStatus = "pending" | "streaming" | "complete" | "error";

export type ChatMessageRecord = ChatMessage & {
  id: string;
  parentId: string | null;
  createdAt: string;
  status: ChatMessageStatus;
  metadata?: Record<string, unknown>;
  errorText?: string;
};

export type ChatThreadRecord = {
  id: string;
  title: string;
  knowledgeBaseId: string | null;
  messages: ChatMessageRecord[];
  createdAt?: string;
  updatedAt?: string;
};

export type ChatRequestBody = {
  id?: string;
  messageId?: string;
  messages: ChatMessage[];
} & Record<string, unknown>;

export type RuntimeMessagePartLike = {
  type?: string;
  text?: string;
  image?: string;
  data?: unknown;
  mediaType?: string;
  mimeType?: string;
  filename?: string;
  fileId?: string;
};

export type RuntimeAttachmentLike = {
  id?: string;
  type?: string;
  name?: string;
  contentType?: string;
  content?: readonly RuntimeMessagePartLike[];
};

export type RuntimeMessageLike = {
  id?: string;
  role?: ChatMessageRole;
  parts?: readonly RuntimeMessagePartLike[];
  attachments?: readonly RuntimeAttachmentLike[];
};

export type ChatTransportPolicy = "latest-user-attachments" | "none";

export type CreateChatRequestOptions = {
  threadId?: string | null;
  baseBody?: Record<string, unknown>;
  historyPolicy?: ChatTransportPolicy;
};

export type ChatEngineCreateRequestInput = {
  messages: readonly RuntimeMessageLike[];
  threadId?: string | null;
  body?: Record<string, unknown>;
  historyPolicy?: ChatTransportPolicy;
};

export interface ChatEngineThreadRepository<
  TThreadSummary = unknown,
  TThreadDetail = TThreadSummary,
> {
  create(input?: Record<string, unknown>): Promise<TThreadSummary>;
  getById(threadId: string): Promise<TThreadDetail>;
  list?(input?: Record<string, unknown>): Promise<TThreadSummary[]>;
  update?(
    threadId: string,
    input: Record<string, unknown>,
  ): Promise<TThreadDetail | TThreadSummary>;
  archive?(threadId: string): Promise<void>;
  remove?(threadId: string): Promise<void>;
}

export interface ChatEngineAttachmentRepository<
  TUploadResult = unknown,
  TDeleteResult = void,
> {
  upload(input: {
    file: unknown;
    filename: string;
    contentType?: string;
  }): Promise<TUploadResult>;
  remove?(attachmentId: string): Promise<TDeleteResult>;
}

export interface ChatEngineTransport {
  createRequestBody(input: ChatEngineCreateRequestInput): ChatRequestBody;
}

export interface ChatEngineStreamTransport {
  send(input: ChatRequestBody): Promise<ReadableStream<Uint8Array>>;
}

export interface ChatEngineMessageRepository {
  list(threadId: string): Promise<ChatMessageRecord[]>;
  create?(
    threadId: string,
    message: Omit<ChatMessageRecord, "createdAt"> & { createdAt?: string },
  ): Promise<ChatMessageRecord>;
}

export interface ChatEngineRepositoryBundle<
  TThreadSummary = ChatThreadRecord,
  TThreadDetail = TThreadSummary,
  TAttachmentUploadResult = unknown,
  TAttachmentDeleteResult = void,
> {
  threads: ChatEngineThreadRepository<TThreadSummary, TThreadDetail>;
  messages?: ChatEngineMessageRepository;
  attachments?: ChatEngineAttachmentRepository<
    TAttachmentUploadResult,
    TAttachmentDeleteResult
  >;
}

export type ChatStreamEvent =
  | { type: "start"; messageId?: string }
  | { type: "text-start"; id?: string }
  | { type: "text-delta"; id?: string; delta: string }
  | { type: "text-end"; id?: string }
  | { type: "data-rag-sources"; data: unknown }
  | { type: "data-rag-node"; data: unknown }
  | { type: "error"; errorText: string }
  | { type: "finish"; finishReason: "stop" | "error" | string }
  | { type: "finish-step" }
  | { type: string; [key: string]: unknown };
