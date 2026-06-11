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
  createdAt: string;
};

const toBranchableHistory = (messages: PersistedHistoryMessage[]) =>
  ExportedMessageRepository.fromBranchableArray(
    messages.map((msg, index) => ({
      parentId: index > 0 ? messages[index - 1]!.id : null,
      message: {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        createdAt: new Date(msg.createdAt),
      },
    })),
    {
      headId: messages.at(-1)?.id ?? null,
    },
  );

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
        `获取对话列表失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
        `重命名对话失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
        `归档对话失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
        `取消归档对话失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
        `删除对话失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
        `创建对话失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
        `获取对话详情失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
            const messages = await getMessages(remoteId);
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
            const content =
              typeof message.content === "string"
                ? message.content
                : message.content?.map((p: any) => p.text || "").join("") || "";

            await createMessage(remoteId, {
              role: message.role as "user" | "assistant" | "system",
              content,
            });
          } catch (error) {
            console.error("[ThreadAdapter] Failed to append message:", error);
            const errorType = getErrorType(error);
            throw new ThreadAdapterError(
              errorType,
              `保存消息失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
              const messages = await getMessages(remoteId);
              console.log(
                "[ThreadAdapter] Loading messages for remoteId:",
                messages,
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
                      parts: [{ type: "text", text: msg.content }],
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

              await createMessage(remoteId, {
                role: content.role as "user" | "assistant" | "system",
                content:
                  content.parts?.map((p) => p.text || "").join("") ||
                  content.content ||
                  "",
              });
            } catch (error) {
              console.error("[ThreadAdapter] Failed to append message:", error);
              const errorType = getErrorType(error);
              throw new ThreadAdapterError(
                errorType,
                `保存消息失败: ${error instanceof Error ? error.message : "未知错误"}`,
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
