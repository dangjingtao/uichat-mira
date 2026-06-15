import type { ProxyProviderParam } from "@/services/provider-proxy.service.js";

/** One assistant-ui text message part accepted by proxy chat routes. */
export interface ChatMessagePart {
  /** Part discriminator. Only `text` parts are consumed by provider normalization. */
  type?: string;
  /** Text payload for a message part. Empty text is ignored during normalization. */
  text?: string;
}

/** Route-layer assistant-ui message shape before service normalization. */
export interface ChatMessageInput {
  /** Chat role accepted by provider and task model routes. */
  role?: "system" | "user" | "assistant";
  /** Assistant-ui parts array. Non-text parts are currently ignored. */
  parts?: ChatMessagePart[];
}

/** Shared request body for provider chat and task-chat endpoints. */
export interface ChatMessagesBody {
  /** Conversation messages. The route rejects requests with no valid text messages. */
  messages: ChatMessageInput[];
}

/** Provider chat path parameter. `default` may route into the RAG pipeline. */
export interface ProviderChatParams {
  /** Provider code or `default` to use the configured default model route. */
  provider: ProxyProviderParam;
}

/** Provider chat body includes optional thread metadata for RAG persistence. */
export interface ProviderChatBody extends ChatMessagesBody {
  /** Thread id from assistant-ui. Required for RAG persistence. */
  id?: string;
  /** Client message id for the latest user message. A UUID is generated when absent. */
  messageId?: string;
}

/** Embedding route body. Strings are normalized into a one-item input array. */
export interface ProviderEmbeddingsBody {
  /** Text or batch of texts to embed. Empty strings are rejected by schema validation. */
  input: string | string[];
}

