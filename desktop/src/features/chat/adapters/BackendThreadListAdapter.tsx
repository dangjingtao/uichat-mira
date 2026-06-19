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
  type CreateMessageInput,
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

type PersistedAttachmentContentPart =
  | {
      type: "image";
      image: string;
      filename?: string;
    }
  | {
      type: "file";
      data: string;
      mimeType: string;
      filename?: string;
    };

type PersistedAttachment = {
  id: string;
  type: "image" | "file";
  name: string;
  contentType: string;
  content: PersistedAttachmentContentPart[];
};

type PersistedAssistantUiMetadata = {
  attachments?: PersistedAttachment[];
  branch?: {
    parentId?: string | null;
  };
  textWasEmpty?: boolean;
};

type SerializableAttachmentLike = {
  id?: string;
  type?: string;
  name?: string;
  contentType?: string;
  content?: Array<
    | {
        type?: string;
        image?: string;
        data?: string;
        mimeType?: string;
        filename?: string;
      }
    | undefined
  >;
};

type PersistableMessageLike = {
  id?: string;
  role?: string;
  content?: unknown;
  attachments?: SerializableAttachmentLike[];
  metadata?: unknown;
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

const projectLinearMessages = (messages: PersistedHistoryMessage[]) => {
  const linear: PersistedHistoryMessage[] = [];

  for (const message of sortPersistedMessages(messages)) {
    const previous = linear.at(-1);

    if (message.role === "assistant" && previous?.role === "assistant") {
      linear[linear.length - 1] = message;
      continue;
    }

    linear.push(message);
  }

  return linear;
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

const getPersistedAssistantUiMetadata = (
  metadata: Record<string, unknown> | undefined,
): PersistedAssistantUiMetadata => {
  const assistantUi = metadata?.assistantUi;

  if (!assistantUi || typeof assistantUi !== "object") {
    return {};
  }

  return assistantUi as PersistedAssistantUiMetadata;
};

const getPersistedAttachments = (
  metadata: Record<string, unknown> | undefined,
): PersistedAttachment[] => {
  const attachments = getPersistedAssistantUiMetadata(metadata).attachments;
  return Array.isArray(attachments) ? attachments : [];
};

const getPersistedParentId = (
  metadata: Record<string, unknown> | undefined,
  fallbackParentId: string | null,
) => {
  const parentId = getPersistedAssistantUiMetadata(metadata).branch?.parentId;
  return typeof parentId === "string" || parentId === null
    ? parentId
    : fallbackParentId;
};

const resolvePersistedParentId = (
  messages: PersistedHistoryMessage[],
  index: number,
) => {
  const message = messages[index];
  if (!message) {
    return null;
  }

  const fallbackParentId = index > 0 ? messages[index - 1]!.id : null;
  const persistedParentId = getPersistedParentId(
    message.metadata,
    fallbackParentId,
  );

  if (persistedParentId === null) {
    return null;
  }

  const messageIds = new Set(messages.map((entry) => entry.id));
  if (messageIds.has(persistedParentId)) {
    return persistedParentId;
  }

  if (message.role === "assistant") {
    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const candidate = messages[cursor];
      if (candidate?.role === "user") {
        return candidate.id;
      }
    }
  }

  return fallbackParentId;
};

const shouldRenderPersistedText = (
  message: PersistedHistoryMessage,
  attachments: PersistedAttachment[],
) => {
  const textWasEmpty = getPersistedAssistantUiMetadata(message.metadata).textWasEmpty;
  return !(textWasEmpty && attachments.length > 0);
};

const toAiSdkFilePart = (attachment: PersistedAttachment) => {
  const contentPart = attachment.content[0];

  if (!contentPart) {
    return null;
  }

  if (contentPart.type === "image") {
    return {
      type: "file" as const,
      mediaType: attachment.contentType || "image/*",
      filename: contentPart.filename || attachment.name,
      url: contentPart.image,
    };
  }

  return {
    type: "file" as const,
    mediaType: contentPart.mimeType || attachment.contentType || "application/octet-stream",
    filename: contentPart.filename || attachment.name,
    url: contentPart.data,
  };
};

const toThreadAttachment = (attachment: PersistedAttachment) => ({
  id: attachment.id,
  type: attachment.type,
  name: attachment.name,
  contentType: attachment.contentType,
  status: { type: "complete" as const },
  content: attachment.content,
});

const serializeAttachmentParts = (
  parts: Array<{
    type?: string;
    mediaType?: string;
    filename?: string;
    url?: string;
  }>,
): PersistedAttachment[] =>
  parts
    .filter((part) => part.type === "file" && typeof part.url === "string")
    .map((part, index) => {
      const filename = part.filename || `attachment-${index + 1}`;
      const mediaType = part.mediaType || "application/octet-stream";
      const isImage = mediaType.startsWith("image/");

      return {
        id: `${filename}-${index}`,
        type: isImage ? "image" : "file",
        name: filename,
        contentType: mediaType,
        content: [
          isImage
            ? {
                type: "image",
                image: part.url!,
                ...(part.filename ? { filename: part.filename } : {}),
              }
            : {
                type: "file",
                data: part.url!,
                mimeType: mediaType,
                ...(part.filename ? { filename: part.filename } : {}),
              },
        ],
      };
    });

const serializeAttachmentEntries = (
  attachments: SerializableAttachmentLike[],
): PersistedAttachment[] =>
  attachments
    .flatMap((attachment, attachmentIndex) => {
      const name = attachment.name || `attachment-${attachmentIndex + 1}`;
      const contentType = attachment.contentType || "application/octet-stream";

      return (attachment.content ?? []).flatMap((part, partIndex) => {
        if (!part) {
          return [];
        }

        if (part.type === "image" && typeof part.image === "string") {
          return [
            {
              id:
                attachment.id ||
                `${name}-${attachmentIndex}-${partIndex}`,
              type: "image" as const,
              name,
              contentType,
              content: [
                {
                  type: "image" as const,
                  image: part.image,
                  ...(part.filename ? { filename: part.filename } : {}),
                },
              ],
            },
          ];
        }

        if (part.type === "file" && typeof part.data === "string") {
          const mimeType = part.mimeType || contentType;

          return [
            {
              id:
                attachment.id ||
                `${name}-${attachmentIndex}-${partIndex}`,
              type: mimeType.startsWith("image/") ? ("image" as const) : ("file" as const),
              name,
              contentType: mimeType,
              content: [
                mimeType.startsWith("image/")
                  ? {
                      type: "image" as const,
                      image: part.data,
                      ...(part.filename ? { filename: part.filename } : {}),
                    }
                  : {
                      type: "file" as const,
                      data: part.data,
                      mimeType,
                      ...(part.filename ? { filename: part.filename } : {}),
                    },
              ],
            },
          ];
        }

        return [];
      });
    });

const dedupePersistedAttachments = (
  attachments: PersistedAttachment[],
): PersistedAttachment[] => {
  const seen = new Set<string>();

  return attachments.filter((attachment) => {
    const part = attachment.content[0];
    const sourceValue =
      part?.type === "image"
        ? part.image
        : part?.type === "file"
          ? part.data
          : "";
    const dedupeKey = `${attachment.name}|${attachment.contentType}|${sourceValue}`;

    if (seen.has(dedupeKey)) {
      return false;
    }

    seen.add(dedupeKey);
    return true;
  });
};

const collectPersistedAttachments = ({
  contentParts,
  attachments,
}: {
  contentParts?: Array<{
    type?: string;
    mediaType?: string;
    filename?: string;
    url?: string;
  }>;
  attachments?: SerializableAttachmentLike[];
}) =>
  dedupePersistedAttachments([
    ...serializeAttachmentParts(
      Array.isArray(contentParts)
        ? contentParts.filter((part) => part.type === "file")
        : [],
    ),
    ...serializeAttachmentEntries(Array.isArray(attachments) ? attachments : []),
  ]);

const getPersistedMessageContent = ({
  textContent,
  attachments,
}: {
  textContent: string;
  attachments: PersistedAttachment[];
}) => {
  const trimmedText = textContent.trim();
  if (trimmedText) {
    return trimmedText;
  }

  const attachmentSummary = attachments
    .map((attachment) => attachment.name?.trim())
    .filter((name): name is string => Boolean(name))
    .join("\n");

  if (attachmentSummary) {
    return attachmentSummary;
  }

  if (attachments.length > 0) {
    return "[attachment]";
  }

  return "";
};

const shouldPersistHistoryEntry = ({
  role,
  content,
  attachments,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  attachments: PersistedAttachment[];
}) => {
  if (content.trim().length > 0 || attachments.length > 0) {
    return true;
  }

  return role === "system";
};

const buildPersistedMetadata = ({
  metadata,
  attachments,
  parentId,
  textWasEmpty,
}: {
  metadata?: Record<string, unknown>;
  attachments: PersistedAttachment[];
  parentId: string | null;
  textWasEmpty: boolean;
}) => {
  const nextMetadata = { ...(metadata ?? {}) };
  const assistantUi: PersistedAssistantUiMetadata = {
    ...getPersistedAssistantUiMetadata(metadata),
    branch: {
      parentId,
    },
    ...(attachments.length > 0 ? { attachments } : {}),
    ...(textWasEmpty ? { textWasEmpty: true } : {}),
  };

  if (attachments.length === 0) {
    delete assistantUi.attachments;
  }

  if (!textWasEmpty) {
    delete assistantUi.textWasEmpty;
  }

  nextMetadata.assistantUi = assistantUi;
  return nextMetadata;
};

const normalizePersistedMetadataInput = (
  metadata: unknown,
): Record<string, unknown> | undefined => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }

  const record = metadata as Record<string, unknown>;
  const custom = record.custom;

  if (custom && typeof custom === "object" && !Array.isArray(custom)) {
    return { ...(custom as Record<string, unknown>) };
  }

  return { ...record };
};

export const toPersistableMessagePayload = ({
  message,
  parentId,
}: {
  message: PersistableMessageLike;
  parentId: string | null;
}): CreateMessageInput | null => {
  if (
    message.role !== "assistant" &&
    message.role !== "user" &&
    message.role !== "system"
  ) {
    return null;
  }

  const contentParts = Array.isArray(message.content)
    ? (message.content as Array<{
        type?: string;
        text?: string;
        mediaType?: string;
        filename?: string;
        url?: string;
      }>)
    : undefined;
  const attachments = collectPersistedAttachments({
    contentParts,
    attachments: Array.isArray(message.attachments)
      ? message.attachments
      : undefined,
  });
  const textContent =
    typeof message.content === "string"
      ? message.content
      : contentParts
          ?.filter((part) => part?.type === "text")
          .map((part) => part.text || "")
          .join("") || "";
  const persistedMetadata = buildPersistedMetadata({
    metadata: normalizePersistedMetadataInput(message.metadata),
    attachments,
    parentId,
    textWasEmpty: textContent.trim().length === 0 && attachments.length > 0,
  });
  const persistedContent = getPersistedMessageContent({
    textContent,
    attachments,
  });

  if (
    !shouldPersistHistoryEntry({
      role: message.role,
      content: persistedContent,
      attachments,
    })
  ) {
    return null;
  }

  return {
    ...(typeof message.id === "string" ? { id: message.id } : {}),
    role: message.role,
    content: persistedContent,
    parentId,
    metadata: persistedMetadata,
  };
};

const toAiSdkMessageParts = (message: PersistedHistoryMessage) => {
  const attachments = getPersistedAttachments(message.metadata);
  const textParts = shouldRenderPersistedText(message, attachments)
    ? [{ type: "text" as const, text: message.content }]
    : [];
  const attachmentParts = attachments
    .map((attachment) => toAiSdkFilePart(attachment))
    .filter((part) => part !== null);
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

  return [...textParts, ...attachmentParts, ...sourceParts];
};

const toThreadMessageContent = (
  message: PersistedHistoryMessage,
  options?: {
    includeAttachmentParts?: boolean;
  },
) => {
  const attachments = getPersistedAttachments(message.metadata);
  const textParts = shouldRenderPersistedText(message, attachments)
    ? [{ type: "text" as const, text: message.content }]
    : [];
  const attachmentParts =
    options?.includeAttachmentParts === false
      ? []
      : attachments
          .flatMap((attachment) => attachment.content)
          .map((part) =>
            part.type === "image"
              ? ({
                  type: "image" as const,
                  image: part.image,
                  ...(part.filename ? { filename: part.filename } : {}),
                })
              : ({
                  type: "file" as const,
                  data: part.data,
                  mimeType: part.mimeType,
                  ...(part.filename ? { filename: part.filename } : {}),
                }),
          );
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

  return [...textParts, ...attachmentParts, ...sourceParts];
};

const toBranchableHistory = (messages: PersistedHistoryMessage[]) =>
  ExportedMessageRepository.fromBranchableArray(
    messages.map((msg, index) => ({
      parentId: resolvePersistedParentId(messages, index),
      message: {
        id: msg.id,
        role: msg.role,
        content: toThreadMessageContent(msg, {
          includeAttachmentParts: msg.role !== "user",
        }),
        createdAt: new Date(msg.createdAt),
        ...(msg.role === "user" &&
        getPersistedAttachments(msg.metadata).length > 0
          ? {
              attachments: getPersistedAttachments(msg.metadata).map(
                toThreadAttachment,
              ),
            }
          : {}),
        metadata: { custom: msg.metadata ?? {} },
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
      const thread = await getThreadById(remoteId);
      if (thread.messageCount === 0) {
        return;
      }

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
            const messages = projectLinearMessages(await getMessages(remoteId));
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

            const payload = toPersistableMessagePayload({
              message,
              parentId: item.parentId ?? null,
            });

            if (!payload) {
              return;
            }

            await createMessage(remoteId, payload);
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
              const messages = projectLinearMessages(await getMessages(remoteId));
              return {
                headId: messages.at(-1)?.id ?? null,
                messages: messages.map((msg, index) =>
                  fmt.decode({
                    id: msg.id,
                    parent_id: resolvePersistedParentId(messages, index),
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
                parts?: Array<{
                  type: string;
                  text?: string;
                  mediaType?: string;
                  filename?: string;
                  url?: string;
                }>;
                content?: string;
                metadata?: Record<string, unknown>;
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

              const payload = toPersistableMessagePayload({
                message: {
                  id:
                    item.message &&
                    typeof item.message === "object" &&
                    "id" in item.message &&
                    typeof item.message.id === "string"
                      ? item.message.id
                      : undefined,
                  role: content.role,
                  content: content.parts ?? content.content,
                  attachments:
                    item.message &&
                    typeof item.message === "object" &&
                    "attachments" in item.message &&
                    Array.isArray(item.message.attachments)
                      ? (item.message.attachments as SerializableAttachmentLike[])
                      : undefined,
                  metadata:
                    item.message &&
                    typeof item.message === "object" &&
                    "metadata" in item.message
                      ? item.message.metadata
                      : content.metadata,
                },
                parentId: item.parentId ?? null,
              });

              if (!payload) {
                return;
              }

              await createMessage(remoteId, payload);
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
