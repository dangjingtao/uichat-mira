import type {
  RemoteThreadListAdapter,
  ThreadHistoryAdapter,
} from "@assistant-ui/react";
import {
  RuntimeAdapterProvider,
  useAui,
  ExportedMessageRepository,
} from "@assistant-ui/react";
import { useMemo, type ReactNode } from "react";
import { createAssistantStream } from "assistant-stream";
import {
  getThreads,
  createThread,
  updateThread,
  archiveThread,
  restoreThread,
  deleteThread,
  getThreadById,
  getMessages,
  createMessage,
  ApiError,
} from "@/shared/api/thread";
import { getRoleModelConfigs } from "@/shared/api/modelSettings";
import { generateTitle } from "@/shared/api/chat";
import { ErrorCodes } from "@/shared/lib/request";
import i18n from "@/shared/i18n";

// 错误类型枚举
export enum ThreadAdapterErrorType {
  NETWORK_ERROR = "NETWORK_ERROR",
  SERVER_ERROR = "SERVER_ERROR",
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  VALIDATION_ERROR = "VALIDATION_ERROR",
}

// 自定义错误类型
export class ThreadAdapterError extends Error {
  constructor(
    public readonly type: ThreadAdapterErrorType,
    message: string,
    public readonly errorCode?: string | number,
  ) {
    super(message);
    this.name = "ThreadAdapterError";
  }
}

// 判断是否为 API 错误
function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// 从错误中提取错误类型
function getErrorType(error: unknown): ThreadAdapterErrorType {
  if (isApiError(error)) {
    switch (error.code) {
      case ErrorCodes.UNAUTHORIZED:
        return ThreadAdapterErrorType.UNAUTHORIZED;
      case ErrorCodes.NOT_FOUND:
        return ThreadAdapterErrorType.NOT_FOUND;
      case ErrorCodes.VALIDATION_ERROR:
        return ThreadAdapterErrorType.VALIDATION_ERROR;
      default:
        return ThreadAdapterErrorType.SERVER_ERROR;
    }
  }
  return ThreadAdapterErrorType.NETWORK_ERROR;
}

type PersistedHistoryMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

type PersistedRagSource = {
  chunkId?: string | number;
  documentId?: string;
  documentName?: string;
  score?: number;
  content?: string;
  matchType?: string;
  hitModes?: string[];
};

const sortPersistedMessages = (messages: PersistedHistoryMessage[]) => {
  return [...messages].sort((left, right) => {
    const createdAtCompare = left.createdAt.localeCompare(right.createdAt);
    if (createdAtCompare !== 0) {
      return createdAtCompare;
    }

    return left.id.localeCompare(right.id);
  });
};

const getPersistedRagSources = (
  metadata: Record<string, unknown> | undefined,
): PersistedRagSource[] => {
  const rag = metadata?.rag;
  if (!rag || typeof rag !== "object" || !("sources" in rag)) {
    return [];
  }

  const sources = (rag as { sources?: unknown }).sources;
  return Array.isArray(sources) ? (sources as PersistedRagSource[]) : [];
};

const toAiSdkMessageParts = (message: PersistedHistoryMessage) => {
  const textParts = [{ type: "text", text: message.content }];
  const sourceParts = getPersistedRagSources(message.metadata).map(
    (source) => ({
      type: "source-document" as const,
      sourceId: String(
        source.chunkId ??
          source.documentId ??
          source.documentName ??
          crypto.randomUUID(),
      ),
      mediaType: "text/plain",
      title: source.documentName || "Knowledge Base Document",
      ...(source.documentName ? { filename: source.documentName } : {}),
      providerMetadata: {
        rag: {
          chunkId: source.chunkId ?? null,
          documentId: source.documentId ?? null,
          score: source.score ?? null,
          content: source.content ?? "",
          matchType: source.matchType ?? null,
          hitModes: source.hitModes ?? [],
        },
      },
    }),
  );

  return [...textParts, ...sourceParts];
};

const toThreadMessageContent = (message: PersistedHistoryMessage) => {
  const textParts = [{ type: "text" as const, text: message.content }];
  const sourceParts = getPersistedRagSources(message.metadata).map(
    (source) => ({
      type: "source" as const,
      sourceType: "document" as const,
      id: String(
        source.chunkId ??
          source.documentId ??
          source.documentName ??
          crypto.randomUUID(),
      ),
      title: source.documentName || "Knowledge Base Document",
      mediaType: "text/plain",
      ...(source.documentName ? { filename: source.documentName } : {}),
      providerMetadata: {
        rag: {
          chunkId: source.chunkId ?? null,
          documentId: source.documentId ?? null,
          score: source.score ?? null,
          content: source.content ?? "",
          matchType: source.matchType ?? null,
          hitModes: source.hitModes ?? [],
        },
      },
    }),
  );

  return [...textParts, ...sourceParts];
};

const toBranchableHistory = (messages: PersistedHistoryMessage[]) =>
  ExportedMessageRepository.fromBranchableArray(
    messages.map((msg, index) => ({
      parentId: index > 0 ? messages[index - 1]!.id : null,
      message: {
        id: msg.id,
        role: msg.role,
        content: toThreadMessageContent(msg),
        createdAt: new Date(msg.createdAt),
        metadata: msg.metadata ?? { custom: {} },
      },
    })),
    {
      headId: messages.at(-1)?.id ?? null,
    },
  );

const shouldPersistMessage = async (threadId: string) => {
  const thread = await getThreadById(threadId);
  return !thread.ragEnabled;
};

export class BackendThreadListAdapter implements RemoteThreadListAdapter {
  async list(): Promise<{
    threads: Array<{
      status: "archived" | "regular";
      remoteId: string;
      externalId: string;
      title: string;
    }>;
  }> {
    try {
      const threads = await getThreads({
        status: "active",
        sortBy: "updatedAt",
        sortOrder: "desc",
      });
      return {
        threads: threads.map((thread) => ({
          status: thread.status === "archived" ? "archived" : "regular",
          remoteId: thread.id,
          externalId: thread.id,
          title: thread.title,
        })),
      };
    } catch (error) {
      const errorType = getErrorType(error);
      throw new ThreadAdapterError(
        errorType,
        i18n.t("chat.adapter.listFailed", {
          error:
            error instanceof Error
              ? error.message
              : i18n.t("chat.adapter.unknownError"),
        }),
        isApiError(error) ? error.code : undefined,
      );
    }
  }

  async rename(remoteId: string, newTitle: string): Promise<void> {
    try {
      await updateThread(remoteId, { title: newTitle });
    } catch (error) {
      const errorType = getErrorType(error);
      throw new ThreadAdapterError(
        errorType,
        i18n.t("chat.adapter.renameFailed", {
          error:
            error instanceof Error
              ? error.message
              : i18n.t("chat.adapter.unknownError"),
        }),
        isApiError(error) ? error.code : undefined,
      );
    }
  }

  async archive(remoteId: string): Promise<void> {
    try {
      await archiveThread(remoteId);
    } catch (error) {
      const errorType = getErrorType(error);
      throw new ThreadAdapterError(
        errorType,
        i18n.t("chat.adapter.archiveFailed", {
          error:
            error instanceof Error
              ? error.message
              : i18n.t("chat.adapter.unknownError"),
        }),
        isApiError(error) ? error.code : undefined,
      );
    }
  }

  async unarchive(remoteId: string): Promise<void> {
    try {
      await restoreThread(remoteId);
    } catch (error) {
      const errorType = getErrorType(error);
      throw new ThreadAdapterError(
        errorType,
        i18n.t("chat.adapter.unarchiveFailed", {
          error:
            error instanceof Error
              ? error.message
              : i18n.t("chat.adapter.unknownError"),
        }),
        isApiError(error) ? error.code : undefined,
      );
    }
  }

  async delete(remoteId: string): Promise<void> {
    try {
      await deleteThread(remoteId);
    } catch (error) {
      const errorType = getErrorType(error);
      throw new ThreadAdapterError(
        errorType,
        i18n.t("chat.adapter.deleteFailed", {
          error:
            error instanceof Error
              ? error.message
              : i18n.t("chat.adapter.unknownError"),
        }),
        isApiError(error) ? error.code : undefined,
      );
    }
  }

  async initialize(threadId: string): Promise<{
    remoteId: string;
    externalId: string | undefined;
  }> {
    try {
      const thread = await createThread({});
      return {
        remoteId: thread.id,
        externalId: thread.id,
      };
    } catch (error) {
      const errorType = getErrorType(error);
      throw new ThreadAdapterError(
        errorType,
        i18n.t("chat.adapter.createFailed", {
          error:
            error instanceof Error
              ? error.message
              : i18n.t("chat.adapter.unknownError"),
        }),
        isApiError(error) ? error.code : undefined,
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async generateTitle(
    remoteId: string,
    unstable_messages: readonly any[],
  ): Promise<ReturnType<typeof createAssistantStream>> {
    // 提取消息内容
    const messageContents = unstable_messages
      .filter((m: any) => m.content)
      .map((m: any) => {
        const content = m.content;
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
          return content.reduce((text: string, part: any) => {
            if (part.type === "text" && part.text) {
              return text + part.text;
            }
            return text;
          }, "");
        }
        return "";
      })
      .join("\n");

    return createAssistantStream(async (controller) => {
      // 调用共享的 generateTitle 函数
      const title = await generateTitle(messageContents);

      // 更新对话标题到后端
      try {
        await updateThread(remoteId, { title });
      } catch (error) {
        console.error("[ThreadAdapter] Failed to update thread title:", error);
      }

      // 将标题输出到 assistant-ui
      controller.appendText(title);
    });
  }

  async fetch(threadId: string): Promise<{
    status: "archived" | "regular";
    remoteId: string;
    externalId: string | undefined;
    title?: string | undefined;
  }> {
    try {
      const thread = await getThreadById(threadId);
      return {
        status: thread.status === "archived" ? "archived" : "regular",
        remoteId: thread.id,
        externalId: thread.id,
        title: thread.title,
      };
    } catch (error) {
      const errorType = getErrorType(error);
      throw new ThreadAdapterError(
        errorType,
        i18n.t("chat.adapter.fetchFailed", {
          error:
            error instanceof Error
              ? error.message
              : i18n.t("chat.adapter.unknownError"),
        }),
        isApiError(error) ? error.code : undefined,
      );
    }
  }

  // 提供 ThreadHistoryAdapter 来加载和保存消息
  unstable_Provider({ children }: { children?: ReactNode }) {
    const aui = useAui();

    const history = useMemo<ThreadHistoryAdapter>(
      () => ({
        // 基础 load/append 方法（某些 runtime 使用）
        async load() {
          const { remoteId } = aui.threadListItem().getState();

          if (!remoteId) {
            return { messages: [] };
          }

          try {
            const messages = sortPersistedMessages(await getMessages(remoteId));
            return toBranchableHistory(messages) as any;
          } catch (error) {
            console.error("[ThreadAdapter] Failed to load messages:", error);
            return { messages: [] } as any;
          }
        },

        async append(item) {
          const { remoteId } = await aui.threadListItem().initialize();
          const message = item.message as any;

          try {
            if (
              (message.role === "assistant" || message.role === "user") &&
              !(await shouldPersistMessage(remoteId))
            ) {
              return;
            }

            const content =
              typeof message.content === "string"
                ? message.content
                : message.content?.map((p: any) => p.text || "").join("") || "";

            await createMessage(remoteId, {
              role: message.role as "user" | "assistant" | "system",
              content,
              metadata: message.metadata,
            });
          } catch (error) {
            console.error("[ThreadAdapter] Failed to append message:", error);
            const errorType = getErrorType(error);
            throw new ThreadAdapterError(
              errorType,
              i18n.t("chat.adapter.saveMessageFailed", {
                error:
                  error instanceof Error
                    ? error.message
                    : i18n.t("chat.adapter.unknownError"),
              }),
              isApiError(error) ? error.code : undefined,
            );
          }
        },

        // withFormat 是 AI SDK useChatRuntime 必需的方法
        withFormat: (fmt) => ({
          async load() {
            const { remoteId } = aui.threadListItem().getState();
            if (!remoteId) {
              return { messages: [] };
            }

            try {
              const messages = sortPersistedMessages(
                await getMessages(remoteId),
              );
              return {
                headId: messages.at(-1)?.id ?? null,
                messages: messages.map((msg, index) =>
                  fmt.decode({
                    id: msg.id,
                    parent_id: index > 0 ? messages[index - 1]!.id : null,
                    format: "ai-sdk/v6",
                    content: {
                      role: msg.role,
                      parts: toAiSdkMessageParts(msg),
                      metadata: msg.metadata ?? { custom: {} },
                    },
                  } as any),
                ),
              } as any;
            } catch (error) {
              console.error("[ThreadAdapter] Failed to load messages:", error);
              return { messages: [] } as any;
            }
          },

          async append(item) {
            const { remoteId } = await aui.threadListItem().initialize();

            try {
              const encoded = fmt.encode(item);

              if (!encoded) {
                console.error(
                  "[ThreadAdapter] Encoded message is undefined or null",
                );
                return;
              }

              // encoded 本身就是消息内容
              const content = encoded as unknown as {
                role: string;
                parts?: Array<{ type: string; text?: string }>;
                content?: string;
              };

              if (!content || !content.role) {
                console.error(
                  "[ThreadAdapter] Invalid message content:",
                  content,
                );
                return;
              }

              if (
                (content.role === "assistant" || content.role === "user") &&
                !(await shouldPersistMessage(remoteId))
              ) {
                return;
              }

              await createMessage(remoteId, {
                role: content.role as "user" | "assistant" | "system",
                content:
                  content.parts?.map((p) => p.text || "").join("") ||
                  content.content ||
                  "",
                metadata:
                  encoded &&
                  typeof encoded === "object" &&
                  "metadata" in encoded &&
                  encoded.metadata &&
                  typeof encoded.metadata === "object"
                    ? (encoded.metadata as Record<string, unknown>)
                    : undefined,
              });
            } catch (error) {
              console.error("[ThreadAdapter] Failed to append message:", error);
              const errorType = getErrorType(error);
              throw new ThreadAdapterError(
                errorType,
                i18n.t("chat.adapter.saveMessageFailed", {
                  error:
                    error instanceof Error
                      ? error.message
                      : i18n.t("chat.adapter.unknownError"),
                }),
                isApiError(error) ? error.code : undefined,
              );
            }
          },
        }),
      }),
      [aui],
    );

    return (
      <RuntimeAdapterProvider adapters={{ history }}>
        {children}
      </RuntimeAdapterProvider>
    );
  }
}
