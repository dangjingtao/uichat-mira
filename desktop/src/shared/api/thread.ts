import { get, post, patch, del, ApiError } from "../lib/request";

// 重新导出 ApiError 以便在其他模块中使用
export { ApiError };

export type ThreadStatus = "active" | "archived" | "deleted";
export type MessageRole = "user" | "assistant" | "system";

export interface Thread {
  id: string;
  title: string;
  modelName: string | null;
  workspaceId: string | null;
  knowledgeBaseId: string | null;
  roleId: string | null;
  agentEnabled?: boolean | null;
  contextSummary: string | null;
  contextSummaryUpdatedAt: string | null;
  status: ThreadStatus;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
}

export interface Message {
  id: string;
  threadId: string;
  role: MessageRole;
  content: string;
  parts: Array<
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
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ThreadWithMessages extends Thread {
  messages: Message[];
}

export interface CreateThreadInput {
  title?: string;
  modelName?: string;
  workspaceId?: string | null;
  knowledgeBaseId?: string | null;
  roleId?: string | null;
  agentEnabled?: boolean | null;
  contextSummary?: string | null;
}

export interface CreateMessageInput {
  id?: string;
  role: MessageRole;
  content: string;
  parentId?: string | null;
  parts?: Message["parts"];
  metadata?: Record<string, unknown>;
}

export interface ThreadListFilters {
  status?: "active" | "archived";
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface ChatWorkspace {
  id: string;
  name: string;
  rootPath: string | null;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
}

// 获取对话列表
export async function getThreads(
  filters?: ThreadListFilters,
): Promise<Thread[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.sortBy) params.append("sortBy", filters.sortBy);
  if (filters?.sortOrder) params.append("sortOrder", filters.sortOrder);

  const query = params.toString();
  return get<Thread[]>(`/threads${query ? `?${query}` : ""}`);
}

// 获取对话详情（含消息）
export async function getThreadById(id: string): Promise<ThreadWithMessages> {
  return get<ThreadWithMessages>(`/threads/${id}`);
}

// 创建新对话
export async function createThread(input?: CreateThreadInput): Promise<Thread> {
  return post<Thread>("/threads", input);
}

// 更新对话
export async function updateThread(
  id: string,
  input: Partial<CreateThreadInput>,
): Promise<Thread> {
  return patch<Thread>(`/threads/${id}`, input);
}

export async function generateThreadContextSummary(
  id: string,
): Promise<Pick<Thread, "contextSummary" | "contextSummaryUpdatedAt">> {
  return post<Pick<Thread, "contextSummary" | "contextSummaryUpdatedAt">>(
    `/threads/${id}/context-summary`,
    {},
  );
}

// 归档对话
export async function archiveThread(id: string): Promise<Thread> {
  return post<Thread>(`/threads/${id}/archive`);
}

// 恢复对话
export async function restoreThread(id: string): Promise<Thread> {
  return post<Thread>(`/threads/${id}/restore`);
}

// 删除对话
export async function deleteThread(id: string): Promise<{ deleted: boolean }> {
  return del<{ deleted: boolean }>(`/threads/${id}`);
}

export async function listChatWorkspaces(): Promise<ChatWorkspace[]> {
  return get<ChatWorkspace[]>("/chat-workspaces");
}

export async function createChatWorkspace(input: {
  name: string;
  rootPath?: string | null;
}): Promise<ChatWorkspace> {
  return post<ChatWorkspace>("/chat-workspaces", input);
}

export async function updateChatWorkspace(
  id: string,
  input: Partial<{ name: string; rootPath: string | null }>,
): Promise<ChatWorkspace> {
  return patch<ChatWorkspace>(`/chat-workspaces/${id}`, input);
}

export async function deleteChatWorkspace(id: string): Promise<{ deleted: boolean }> {
  return del<{ deleted: boolean }>(`/chat-workspaces/${id}`);
}

// 获取对话消息
export async function getMessages(threadId: string): Promise<Message[]> {
  return get<Message[]>(`/threads/${threadId}/messages`);
}

// 创建消息
export async function createMessage(
  threadId: string,
  input: CreateMessageInput,
): Promise<Message> {
  return post<Message>(`/threads/${threadId}/messages`, input);
}

// 删除消息
export async function deleteMessage(id: string): Promise<{ deleted: boolean }> {
  return del<{ deleted: boolean }>(`/messages/${id}`);
}
