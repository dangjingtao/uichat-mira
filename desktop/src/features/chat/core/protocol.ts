import type { ChatMessagePart, ChatRunEvent } from "@/shared/uchat/core";
import { getApiBaseUrl, getChatApiUrl } from "@/shared/platform/desktopRuntime";
import { getSession } from "@/shared/lib/sessionStorage";
import type {
  CreateThreadInput,
  CreateMessageInput as ThreadCreateMessageInput,
  Message as ThreadApiMessage,
  Thread as ThreadApiSummary,
  ThreadWithMessages,
} from "@/shared/api/thread";
import {
  archiveThread,
  createMessage as createThreadMessage,
  createThread,
  deleteThread,
  generateThreadContextSummary,
  getThreadById,
  getThreads,
  updateThread,
} from "@/shared/api/thread";
import { uploadChatAttachment } from "@/shared/api/attachments";
import type {
  ChatAttachmentDriver,
  ChatMessage,
  ChatRole,
  ChatMessagePart as CoreChatMessagePart,
  ChatRepository,
  ChatRunContext,
  ChatRunDriver,
  ChatToolTraceEntry,
  ChatThread,
  ChatThreadSummary,
} from "@/shared/uchat/core";

// The current backend chat endpoint accepts this canonical request shape.
type ProxyMessagePart =
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
    };

type ProxyMessagePartInput =
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
    };

// Thread list summaries are mapped into the protocol-agnostic uchat shape.
const normalizeThreadSummary = (thread: ThreadApiSummary): ChatThreadSummary => ({
  id: thread.id,
  title: thread.title,
  workspaceId: thread.workspaceId ?? null,
  createdAt: thread.createdAt,
  updatedAt: thread.updatedAt,
  metadata: {
    workspaceId: thread.workspaceId,
    modelName: thread.modelName,
    knowledgeBaseId: thread.knowledgeBaseId,
    roleId: thread.roleId,
    agentEnabled: thread.agentEnabled,
    ttsEnabled: thread.ttsEnabled,
    imageEnabled: thread.imageEnabled,
    contextSummary: thread.contextSummary,
    contextSummaryUpdatedAt: thread.contextSummaryUpdatedAt,
    status: thread.status,
    messageCount: thread.messageCount,
    lastMessage: thread.lastMessage,
  },
});

// Thread detail responses now expose canonical message parts directly. The
// desktop adapter only accepts that normalized contract.
export const normalizeMessageParts = (
  message: ThreadApiMessage,
): CoreChatMessagePart[] => {
  return message.parts.flatMap<CoreChatMessagePart>((part) => {
    if (part.type === "text") {
      return [{ type: "text" as const, text: part.text }];
    }

    if (part.type === "image") {
      return [
        {
          type: "image" as const,
          source: part.image,
          ...(part.mediaType ? { mimeType: part.mediaType } : {}),
          ...(part.filename ? { name: part.filename } : {}),
          ...(part.fileId ? { assetId: part.fileId } : {}),
        },
      ];
    }

    if (part.type === "file") {
      return [
        {
          type: "file" as const,
          source: part.data,
          mimeType: part.mimeType,
          name: part.filename,
          ...(part.fileId ? { assetId: part.fileId } : {}),
        },
      ];
    }

    if (part.type === "data") {
      return [
        {
          type: "data" as const,
          name: part.name,
          value: part.value,
        },
      ];
    }

    return [];
  });
};

// Normalizes one backend message into the uchat canonical model.
const normalizeMessage = (
  threadId: string,
  message: ThreadApiMessage,
  previousMessageId: string | null,
): ChatMessage => {
  const legacyTools = Array.isArray(message.metadata?.tools)
    ? message.metadata.tools
        .flatMap<ChatToolTraceEntry>((entry) => {
          if (!entry || typeof entry !== "object") {
            return [];
          }

          const candidate = entry as Record<string, unknown>;
          if (
            typeof candidate.toolName !== "string" ||
            typeof candidate.status !== "string"
          ) {
            return [];
          }

          return [
            {
              ...(typeof candidate.toolCallId === "string"
                ? { toolCallId: candidate.toolCallId }
                : {}),
              toolName: candidate.toolName,
              status: candidate.status as ChatToolTraceEntry["status"],
              ...(candidate.input && typeof candidate.input === "object"
                ? { input: candidate.input as Record<string, unknown> }
                : {}),
              ...(Object.prototype.hasOwnProperty.call(candidate, "output")
                ? { output: candidate.output }
                : {}),
              ...(typeof candidate.errorMessage === "string"
                ? { errorMessage: candidate.errorMessage }
                : {}),
            },
          ];
        })
    : [];

  return {
    id: message.id,
    threadId,
    role: message.role,
    parts: normalizeMessageParts(message),
    createdAt: message.createdAt,
    parentId: previousMessageId,
    status: "complete",
    ...(legacyTools.length > 0 ? { toolTrace: legacyTools } : {}),
    metadata: message.metadata,
  };
};

// Normalizes one backend thread detail payload into the uchat canonical model.
const normalizeThread = (thread: ThreadWithMessages): ChatThread => {
  let previousMessageId: string | null = null;
  const messages = thread.messages.map((message) => {
    const normalized = normalizeMessage(thread.id, message, previousMessageId);
    previousMessageId = normalized.id;
    return normalized;
  });

  return {
    ...normalizeThreadSummary(thread),
    messages,
  };
};

// Converts uchat canonical parts into the current backend request protocol.
const toProxyPart = (part: ChatMessagePart): ProxyMessagePart | null => {
  if (part.type === "text") {
    return part.text.trim() ? { type: "text", text: part.text } : null;
  }

  if (part.type === "image") {
    return {
      type: "image",
      image: part.source,
      ...(part.name ? { filename: part.name } : {}),
      ...(part.assetId ? { fileId: part.assetId } : {}),
      ...(part.mimeType ? { mediaType: part.mimeType } : {}),
    };
  }

  if (part.type === "file") {
    return {
      type: "file",
      data: part.source,
      filename: part.name,
      mimeType: part.mimeType,
      ...(part.assetId ? { fileId: part.assetId } : {}),
    };
  }

  return null;
};

// Converts hydrated history into the backend request message format.
const toProxyMessages = (messages: ChatMessage[]) =>
  messages
    .map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts
        .map((part) => toProxyPart(part))
        .filter((part): part is ProxyMessagePart => part !== null),
    }))
    .filter((message) => message.parts.length > 0);

// Parses one raw SSE data frame from the current backend stream.
const parseEventPayload = (data: string) => {
  const trimmed = data.trim();
  if (!trimmed || trimmed === "[DONE]") {
    return null;
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }
};

// The backend stream is plain SSE. This helper extracts one complete `data:`
// frame at a time so the adapter does not depend on any extra parser package.
const readSseFrames = (
  buffer: string,
): {
  frames: string[];
  rest: string;
} => {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const segments = normalized.split("\n\n");

  if (segments.length === 1) {
    return {
      frames: [],
      rest: normalized,
    };
  }

  const rest = segments.pop() ?? "";
  const frames = segments
    .map((segment) =>
      segment
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n"),
    )
    .filter(Boolean);

  return {
    frames,
    rest,
  };
};

// Maps the current backend SSE protocol into transport-agnostic uchat events.
const toRunEvent = (payload: Record<string, unknown>): ChatRunEvent | null => {
  if (payload.type === "text-delta" && typeof payload.delta === "string") {
    return {
      type: "message:part",
      part: { type: "text", text: payload.delta },
      ...(typeof payload.id === "string" ? { messageId: payload.id } : {}),
    };
  }

  if (payload.type === "data-rag-sources") {
    return {
      type: "message:metadata",
      metadata: {
        rag: {
          sources: payload.data,
        },
      },
    };
  }

  if (payload.type === "data-rag-node") {
    return {
      type: "message:part",
      part: {
        type: "data",
        name: "execution-node",
        value: payload.data,
      },
    };
  }

  if (payload.type === "data-execution-node") {
    return {
      type: "message:part",
      part: {
        type: "data",
        name: "execution-node",
        value: payload.data,
      },
    };
  }

  if (payload.type === "data-tool-event" && payload.data && typeof payload.data === "object") {
    const data = payload.data as Record<string, unknown>;
    if (typeof data.toolName === "string" && typeof data.status === "string") {
      return {
        type: "message:tool",
        ...(typeof data.callId === "string" ? { toolCallId: data.callId } : {}),
        toolName: data.toolName,
        status: data.status as "requested" | "running" | "succeeded" | "failed",
        ...(data.input && typeof data.input === "object" ? { input: data.input as Record<string, unknown> } : {}),
        ...(Object.prototype.hasOwnProperty.call(data, "output") ? { output: data.output } : {}),
        ...(typeof data.errorMessage === "string" ? { errorMessage: data.errorMessage } : {}),
      };
    }
  }

  if (payload.type === "error" && typeof payload.errorText === "string") {
    return {
      type: "run:error",
      errorMessage: payload.errorText,
    };
  }

  if (
    payload.type === "finish" &&
    (payload.finishReason === undefined || payload.finishReason === "stop")
  ) {
    return { type: "message:finish" };
  }

  return null;
};

export const __protocolTestUtils = {
  normalizeMessage,
  parseEventPayload,
  readSseFrames,
  toRunEvent,
};

// DesktopChatRepository adapts the current thread REST API to the uchat
// repository interface. This is app glue, not part of core.
export class DesktopChatRepository implements ChatRepository {
  constructor(
    private readonly getCreateThreadInput: () => CreateThreadInput | undefined,
  ) {}

  // Loads sidebar thread summaries.
  async listThreads() {
    const threads = await getThreads({
      sortBy: "updatedAt",
      sortOrder: "desc",
    });

    return threads.map(normalizeThreadSummary);
  }

  // Loads one hydrated thread with its full history.
  async getThread(threadId: string) {
    const thread = await getThreadById(threadId);
    return normalizeThread(thread);
  }

  // Creates a thread using the app's current KB and RAG defaults.
  async createThread(input?: { title?: string; metadata?: Record<string, unknown> }) {
    const createInput = this.getCreateThreadInput();
    const inputWorkspaceId =
      input?.metadata && Object.prototype.hasOwnProperty.call(input.metadata, "workspaceId")
        ? typeof input.metadata.workspaceId === "string" || input.metadata.workspaceId === null
          ? input.metadata.workspaceId
          : undefined
        : undefined;
    const inputRoleId =
      input?.metadata && Object.prototype.hasOwnProperty.call(input.metadata, "roleId")
        ? typeof input.metadata.roleId === "string" || input.metadata.roleId === null
          ? input.metadata.roleId
          : undefined
        : undefined;
    const nextWorkspaceId =
      typeof inputWorkspaceId === "string" || inputWorkspaceId === null
        ? inputWorkspaceId
        : createInput?.workspaceId;
    const nextRoleId =
      typeof inputRoleId === "string" || inputRoleId === null
        ? inputRoleId
        : createInput?.roleId;
    const thread = await createThread({
      ...(typeof createInput?.knowledgeBaseId === "string"
        ? { knowledgeBaseId: createInput.knowledgeBaseId }
        : {}),
      ...(typeof nextWorkspaceId === "string" ||
      nextWorkspaceId === null
        ? { workspaceId: nextWorkspaceId }
        : {}),
      ...(typeof nextRoleId === "string" || nextRoleId === null
        ? { roleId: nextRoleId }
        : {}),
      ...(typeof createInput?.agentEnabled === "boolean" ||
      createInput?.agentEnabled === null
        ? { agentEnabled: createInput.agentEnabled }
        : {}),
      ...(typeof createInput?.ttsEnabled === "boolean" ||
      createInput?.ttsEnabled === null
        ? { ttsEnabled: createInput.ttsEnabled }
        : {}),
      ...(typeof createInput?.imageEnabled === "boolean" ||
      createInput?.imageEnabled === null
        ? { imageEnabled: createInput.imageEnabled }
        : {}),
      ...(typeof createInput?.modelName === "string"
        ? { modelName: createInput.modelName }
        : {}),
      ...(typeof createInput?.contextSummary === "string" ||
      createInput?.contextSummary === null
        ? { contextSummary: createInput.contextSummary }
        : {}),
      ...(input?.title ? { title: input.title } : {}),
    });

    return {
      ...normalizeThreadSummary(thread),
      messages: [],
    };
  }

  // Writes one thread message through the existing message persistence API.
  async createMessage(
    threadId: string,
    input: {
      id?: string;
      role: ChatRole;
      content: string;
      parentId?: string | null;
      parts?: CoreChatMessagePart[];
      metadata?: Record<string, unknown>;
    },
  ) {
    const metadata = input.metadata ?? undefined;
    const normalizedParts = input.parts?.map<ProxyMessagePartInput | null>((part) => {
      if (part.type === "text") {
        return { type: "text" as const, text: part.text };
      }

      if (part.type === "image") {
        return {
          type: "image" as const,
          image: part.source,
          ...(part.name ? { filename: part.name } : {}),
          ...(part.assetId ? { fileId: part.assetId } : {}),
          ...(part.mimeType ? { mediaType: part.mimeType } : {}),
        };
      }

      if (part.type === "file") {
        return {
          type: "file" as const,
          data: part.source,
          filename: part.name,
          ...(part.assetId ? { fileId: part.assetId } : {}),
          mimeType: part.mimeType,
        };
      }

      return null;
    }).filter((part): part is NonNullable<typeof part> => part !== null);
    const message = await createThreadMessage(threadId, {
      id: input.id,
      role: input.role,
      content:
        normalizedParts?.some((part) => part.type === "text")
          ? normalizedParts
              .filter((part): part is Extract<typeof part, { type: "text" }> =>
                part.type === "text",
              )
              .map((part) => part.text)
              .join("\n")
          : input.content,
      parentId: input.parentId ?? undefined,
      parts: normalizedParts ?? undefined,
      metadata,
    });

    return {
      id: message.id,
      threadId: message.threadId,
      role: message.role,
      parts: normalizeMessageParts(message),
      createdAt: message.createdAt,
      parentId: input.parentId ?? null,
      status: "complete" as const,
      metadata: message.metadata,
    };
  }

  // Updates mutable thread fields exposed by the current backend.
  async updateThread(
    threadId: string,
    input: { title?: string; workspaceId?: string | null; metadata?: Record<string, unknown> },
  ) {
    const metadata = input.metadata;
    const nextWorkspaceId =
      typeof input.workspaceId === "string" || input.workspaceId === null
        ? input.workspaceId
        : undefined;
    const nextKnowledgeBaseId =
      metadata && Object.prototype.hasOwnProperty.call(metadata, "knowledgeBaseId")
        ? typeof metadata.knowledgeBaseId === "string" ||
          metadata.knowledgeBaseId === null
          ? metadata.knowledgeBaseId
          : undefined
        : undefined;
    const nextRoleId =
      metadata && Object.prototype.hasOwnProperty.call(metadata, "roleId")
        ? typeof metadata.roleId === "string" || metadata.roleId === null
          ? metadata.roleId
          : undefined
        : undefined;
    const nextAgentEnabled =
      metadata && Object.prototype.hasOwnProperty.call(metadata, "agentEnabled")
        ? typeof metadata.agentEnabled === "boolean" ||
          metadata.agentEnabled === null
          ? metadata.agentEnabled
          : undefined
        : undefined;
    const nextTtsEnabled =
      metadata && Object.prototype.hasOwnProperty.call(metadata, "ttsEnabled")
        ? typeof metadata.ttsEnabled === "boolean" || metadata.ttsEnabled === null
          ? metadata.ttsEnabled
          : undefined
        : undefined;
    const nextImageEnabled =
      metadata && Object.prototype.hasOwnProperty.call(metadata, "imageEnabled")
        ? typeof metadata.imageEnabled === "boolean" || metadata.imageEnabled === null
          ? metadata.imageEnabled
          : undefined
        : undefined;
    const nextContextSummary =
      metadata && Object.prototype.hasOwnProperty.call(metadata, "contextSummary")
        ? typeof metadata.contextSummary === "string" ||
          metadata.contextSummary === null
          ? metadata.contextSummary
          : undefined
        : undefined;
    const thread = await updateThread(threadId, {
      ...(typeof input.title === "string" ? { title: input.title } : {}),
      ...(typeof nextWorkspaceId === "string" || nextWorkspaceId === null
        ? { workspaceId: nextWorkspaceId }
        : {}),
      ...(typeof nextKnowledgeBaseId === "string" ||
      nextKnowledgeBaseId === null
        ? { knowledgeBaseId: nextKnowledgeBaseId }
        : {}),
      ...(typeof nextRoleId === "string" || nextRoleId === null
        ? { roleId: nextRoleId }
        : {}),
      ...(typeof nextAgentEnabled === "boolean" || nextAgentEnabled === null
        ? { agentEnabled: nextAgentEnabled }
        : {}),
      ...(typeof nextTtsEnabled === "boolean" || nextTtsEnabled === null
        ? { ttsEnabled: nextTtsEnabled }
        : {}),
      ...(typeof nextImageEnabled === "boolean" || nextImageEnabled === null
        ? { imageEnabled: nextImageEnabled }
        : {}),
      ...(typeof nextContextSummary === "string" || nextContextSummary === null
        ? { contextSummary: nextContextSummary }
        : {}),
    });

    return {
      ...normalizeThreadSummary(thread),
      messages: [],
    };
  }

  // Archives a thread through the current backend API.
  async archiveThread(threadId: string) {
    await archiveThread(threadId);
  }

  // Permanently deletes a thread through the current backend API.
  async deleteThread(threadId: string) {
    await deleteThread(threadId);
  }

  async generateContextSummary(threadId: string) {
    return generateThreadContextSummary(threadId);
  }
}

// DesktopChatAttachmentDriver adapts the current attachment upload endpoint to
// the uchat attachment driver contract.
export class DesktopChatAttachmentDriver implements ChatAttachmentDriver {
  async upload(file: File) {
    const uploaded = await uploadChatAttachment(file);
    if (uploaded.contentType.startsWith("image/")) {
      return {
        type: "image" as const,
        source: uploaded.url,
        mimeType: uploaded.contentType,
        name: uploaded.fileName,
        assetId: uploaded.id,
      };
    }

    return {
      type: "file" as const,
      source: uploaded.url,
      mimeType: uploaded.contentType,
      name: uploaded.fileName,
      assetId: uploaded.id,
    };
  }
}

// DesktopChatRunDriver adapts the current backend SSE protocol to uchat run
// events. This keeps protocol coupling outside the core package.
export class DesktopChatRunDriver implements ChatRunDriver {
  async run(context: ChatRunContext, onEvent: (event: ChatRunEvent) => void | Promise<void>) {
    const token = getSession()?.token ?? "";
    const response = await fetch(getChatApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        id: context.thread.id,
        messageId: context.message.id,
        messages: toProxyMessages([...context.history, context.message]),
        ...(typeof context.options?.agentEnabled === "boolean"
          ? { agentEnabled: context.options.agentEnabled }
          : {}),
        ...(context.options?.requestedToolGroupIds?.length
          ? { requestedToolGroupIds: context.options.requestedToolGroupIds }
          : {}),
      }),
      signal: context.signal,
    });

    if (!response.ok) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("Chat stream body is empty");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const { frames, rest } = readSseFrames(buffer);
      buffer = rest;

      for (const frame of frames) {
        const payload = parseEventPayload(frame);
        if (!payload) {
          continue;
        }

        const runEvent = toRunEvent(payload);
        if (runEvent) {
          await onEvent(runEvent);
        }
      }
    }

    buffer += decoder.decode();
    const { frames } = readSseFrames(`${buffer}\n\n`);
    for (const frame of frames) {
      const payload = parseEventPayload(frame);
      if (!payload) {
        continue;
      }

      const runEvent = toRunEvent(payload);
      if (runEvent) {
        await onEvent(runEvent);
      }
    }

    await onEvent({ type: "run:finish" });
  }
}

// resolveAttachmentSource expands relative attachment URLs for packaged shells.
export const resolveAttachmentSource = (value: string) =>
  value.startsWith("/attachments/") ? `${getApiBaseUrl()}${value}` : value;
