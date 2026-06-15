/** Query params accepted by the thread list endpoint. */
export interface ThreadListQuery {
  /** Thread lifecycle filter. Omitted returns both active and archived threads. */
  status?: "active" | "archived";
  /** Sort field exposed to the UI. */
  sortBy?: "createdAt" | "updatedAt";
  /** Sort direction passed through to the service layer. */
  sortOrder?: "asc" | "desc";
}

/** Body for creating or updating a thread. */
export interface ThreadMutationBody {
  /** User-facing title. Empty/omitted titles are handled by the service. */
  title?: string;
  /** Optional display name of the selected model for this conversation. */
  modelName?: string;
  /** Enables RAG routing for provider-default chat requests in this thread. */
  ragEnabled?: boolean;
}

/** Body for creating a persisted message in a thread. */
export interface CreateMessageBody {
  /** Message author role. */
  role: "user" | "assistant" | "system";
  /** Message text. The route enforces the maximum content length. */
  content: string;
  /** Free-form message metadata, including RAG source payloads. */
  metadata?: Record<string, unknown>;
}

