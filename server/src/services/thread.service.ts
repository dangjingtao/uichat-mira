import {
  messageRepository,
  threadRepository,
  type ThreadListFilters,
  type ThreadWithMessageCount,
} from "@/db/repositories";
import type { Message, MessageRole, Thread, ThreadStatus } from "@/db/schema";
import { THREAD_ACCESS_ERROR_MESSAGE } from "@/utils/errors.js";

export interface ThreadResponse {
  id: string;
  title: string;
  modelName: string | null;
  ragEnabled: boolean;
  status: ThreadStatus;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

export interface MessageResponse {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ThreadWithMessagesResponse extends ThreadResponse {
  messages: MessageResponse[];
}

export interface CreateThreadInput {
  userId: number;
  title?: string;
  modelName?: string;
  ragEnabled?: boolean;
}

export interface CreateMessageInput {
  id?: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
}

const toThreadResponse = (
  thread: Thread,
  messages?: Message[],
): ThreadResponse => {
  const messageCount = messages?.length ?? 0;
  const lastMessage = messages?.length
    ? messages[messages.length - 1].content.substring(0, 50) +
      (messages[messages.length - 1].content.length > 50 ? "..." : "")
    : undefined;

  return {
    id: thread.id,
    title: thread.title || "新对话",
    modelName: thread.modelName ?? null,
    ragEnabled: thread.ragEnabled,
    status: thread.status,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messageCount,
    lastMessage,
  };
};

// 优化版本：从预计算的统计数据转换
const toThreadResponseFromStats = (
  thread: ThreadWithMessageCount,
): ThreadResponse => {
  const lastMessage = thread.lastMessageContent
    ? thread.lastMessageContent.substring(0, 50) +
      (thread.lastMessageContent.length > 50 ? "..." : "")
    : undefined;

  return {
    id: thread.id,
    title: thread.title || "新对话",
    modelName: thread.modelName ?? null,
    ragEnabled: thread.ragEnabled,
    status: thread.status,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messageCount: thread.messageCount,
    lastMessage,
  };
};

const toMessageResponse = (message: Message): MessageResponse => {
  let metadata: Record<string, unknown> = {};
  if (message.metadata) {
    try {
      metadata = JSON.parse(message.metadata);
    } catch {
      metadata = {};
    }
  }
  return {
    id: message.id,
    threadId: message.threadId,
    role: message.role,
    content: message.content,
    metadata,
    createdAt: message.createdAt,
  };
};

export interface GetThreadInput {
  id: string;
  userId?: number;
}

export const threadService = {
  listThreads(filters: ThreadListFilters): ThreadResponse[] {
    // 使用优化后的查询，一次性获取线程列表及其消息统计（避免 N+1 问题）
    const threadsWithStats = threadRepository.listWithMessageStats(filters);
    return threadsWithStats.map(toThreadResponseFromStats);
  },

  getThreadById(
    id: string,
    userId?: number,
  ): ThreadWithMessagesResponse | null {
    const result = threadRepository.findByIdWithMessages(id, userId);
    if (!result) {
      return null;
    }

    return {
      ...toThreadResponse(result.thread, result.messages),
      messages: result.messages.map(toMessageResponse),
    };
  },

  getThreadSummaryById(id: string, userId?: number): ThreadResponse | null {
    const thread = threadRepository.findById(id, userId);
    if (!thread) {
      return null;
    }

    return toThreadResponse(thread, messageRepository.listByThread(thread.id));
  },

  createThread(input: CreateThreadInput): ThreadResponse {
    const created = threadRepository.create({
      userId: input.userId,
      title: input.title?.trim() || "",
      modelName: input.modelName?.trim() || undefined,
      ragEnabled: input.ragEnabled ?? false,
      status: "active",
    });

    return toThreadResponse(created, []);
  },

  updateThread(
    id: string,
    userId: number,
    input: Partial<Omit<CreateThreadInput, "userId">>,
  ): ThreadResponse | null {
    const existing = threadRepository.findById(id, userId);
    if (!existing) {
      return null;
    }

    // 如果没有需要更新的字段，直接返回现有数据
    if (
      input.title === undefined &&
      input.modelName === undefined &&
      input.ragEnabled === undefined
    ) {
      return toThreadResponse(
        existing,
        messageRepository.listByThread(existing.id),
      );
    }

    const updateData: Record<string, unknown> = {};
    if (typeof input.title === "string") {
      updateData.title = input.title.trim();
    }
    if (typeof input.modelName === "string") {
      updateData.modelName = input.modelName.trim() || null;
    }
    if (typeof input.ragEnabled === "boolean") {
      updateData.ragEnabled = input.ragEnabled;
    }

    const updated = threadRepository.updateById(id, updateData);
    if (!updated) {
      return null;
    }

    const messages = messageRepository.listByThread(updated.id);
    return toThreadResponse(updated, messages);
  },

  archiveThread(id: string, userId: number): ThreadResponse | null {
    const existing = threadRepository.findById(id, userId);
    if (!existing) {
      return null;
    }

    const updated = threadRepository.archiveById(id);
    if (!updated) {
      return null;
    }

    const messages = messageRepository.listByThread(updated.id);
    return toThreadResponse(updated, messages);
  },

  restoreThread(id: string, userId: number): ThreadResponse | null {
    const existing = threadRepository.findById(id, userId);
    if (!existing) {
      return null;
    }

    const updated = threadRepository.restoreById(id);
    if (!updated) {
      return null;
    }

    const messages = messageRepository.listByThread(updated.id);
    return toThreadResponse(updated, messages);
  },

  deleteThread(id: string, userId: number): boolean {
    const existing = threadRepository.findById(id, userId);
    if (!existing) {
      return false;
    }
    return threadRepository.deleteById(id);
  },

  createMessage(
    threadId: string,
    userId: number,
    input: CreateMessageInput,
  ): MessageResponse {
    // 验证线程属于当前用户
    const thread = threadRepository.findById(threadId, userId);
    if (!thread) {
      throw new Error(THREAD_ACCESS_ERROR_MESSAGE);
    }

    const created = messageRepository.create({
      ...(input.id ? { id: input.id } : {}),
      threadId,
      role: input.role,
      content: input.content.trim(),
      metadata: input.metadata ? JSON.stringify(input.metadata) : "{}",
    });

    // 更新 thread 的 updatedAt
    threadRepository.updateById(threadId, {});

    return toMessageResponse(created);
  },

  createMessages(
    threadId: string,
    userId: number,
    inputs: CreateMessageInput[],
  ): MessageResponse[] {
    // 验证线程属于当前用户
    const thread = threadRepository.findById(threadId, userId);
    if (!thread) {
      throw new Error(THREAD_ACCESS_ERROR_MESSAGE);
    }

    const messages = messageRepository.createBatch(
      threadId,
      inputs.map((input) => ({
        role: input.role,
        content: input.content.trim(),
        metadata: input.metadata ? JSON.stringify(input.metadata) : "{}",
      })),
    );

    // 更新 thread 的 updatedAt
    threadRepository.updateById(threadId, {});

    return messages.map(toMessageResponse);
  },

  getMessages(threadId: string, userId: number): MessageResponse[] {
    // 验证线程属于当前用户
    const thread = threadRepository.findById(threadId, userId);
    if (!thread) {
      throw new Error(THREAD_ACCESS_ERROR_MESSAGE);
    }

    const messages = messageRepository.listByThread(threadId);
    return messages.map(toMessageResponse);
  },

  getMessageById(id: string, userId: number): MessageResponse | null {
    const message = messageRepository.findById(id);
    if (!message) {
      return null;
    }

    // 验证消息所属线程属于当前用户
    const thread = threadRepository.findById(message.threadId, userId);
    if (!thread) {
      return null;
    }

    return toMessageResponse(message);
  },

  deleteMessage(id: string, userId: number): boolean {
    const message = messageRepository.findById(id);
    if (!message) {
      return false;
    }

    // 验证消息所属线程属于当前用户
    const thread = threadRepository.findById(message.threadId, userId);
    if (!thread) {
      return false;
    }

    const deleted = messageRepository.deleteById(id);
    if (deleted) {
      threadRepository.updateById(message.threadId, {});
    }

    return deleted;
  },
};
