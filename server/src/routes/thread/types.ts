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
  /** Bound knowledge base id for this thread. */
  knowledgeBaseId?: string | null;
}

/** Body for creating a persisted message in a thread. */
export interface CreateMessageBody {
  /** Optional stable message id from the client/runtime for idempotent persistence. */
  id?: string;
  /** Optional parent message id used to linearize regenerate/edit flows. */
  parentId?: string | null;
  /** Message author role. */
  role: "user" | "assistant" | "system";
  /** Message text. The route enforces the maximum content length. */
  content: string;
  /** Canonical message parts for text and attachments. */
  parts?: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image";
        image: string;
        filename?: string;
        fileId?: string;
        mediaType?: string;
      }
    | {
        type: "file";
        data: string;
        filename: string;
        fileId?: string;
        mimeType: string;
      }
  >;
  /** Free-form message metadata, including RAG source payloads. */
  metadata?: Record<string, unknown>;
}
