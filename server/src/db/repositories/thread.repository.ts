import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  messages,
  threads,
  type Message,
  type NewMessage,
  type NewThread,
  type Thread,
} from "@/db/schema";
import { nowIso } from "@/utils/time.js";

export interface ThreadListFilters {
  userId: number;
  status?: "active" | "archived";
  sortBy?: "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface ThreadWithMessageCount extends Thread {
  messageCount: number;
  lastMessageContent: string | null;
}

type MessageRow = Message & { partsJson?: string | null };

const selectMessageColumns = {
  id: messages.id,
  threadId: messages.threadId,
  role: messages.role,
  content: messages.content,
  partsJson: messages.partsJson,
  metadata: messages.metadata,
  createdAt: messages.createdAt,
};

export const threadRepository = {
  list(filters: ThreadListFilters): Thread[] {
    const db = getDb();
    const conditions: any[] = [];

    conditions.push(eq(threads.userId, filters.userId));

    if (filters.status) {
      conditions.push(eq(threads.status, filters.status));
    } else {
      conditions.push(eq(threads.status, "active"));
    }

    const orderColumn =
      filters.sortBy === "createdAt" ? threads.createdAt : threads.updatedAt;

    return db
      .select()
      .from(threads)
      .where(and(...conditions))
      .orderBy(
        filters.sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn),
      )
      .all();
  },

  // 优化版本：使用子查询一次性获取线程列表及其消息统计
  listWithMessageStats(filters: ThreadListFilters): ThreadWithMessageCount[] {
    const db = getDb();
    const conditions: any[] = [];

    conditions.push(eq(threads.userId, filters.userId));

    if (filters.status) {
      conditions.push(eq(threads.status, filters.status));
    } else {
      conditions.push(eq(threads.status, "active"));
    }

    const orderColumn =
      filters.sortBy === "createdAt" ? threads.createdAt : threads.updatedAt;

    // 使用子查询获取每个线程的消息数量和最后一条消息
    const messageCountSubquery = sql<number>`(
      SELECT COUNT(*) FROM messages WHERE ${messages.threadId} = ${threads.id}
    )`;
    const lastMessageSubquery = sql<string | null>`(
      SELECT content FROM messages 
      WHERE ${messages.threadId} = ${threads.id}
      ORDER BY created_at DESC, rowid DESC LIMIT 1
    )`;

    // 手动映射结果，避免类型转换问题
    const results = db
      .select({
        id: threads.id,
        title: threads.title,
        modelName: threads.modelName,
        workspaceId: threads.workspaceId,
        knowledgeBaseId: threads.knowledgeBaseId,
        roleId: threads.roleId,
        agentEnabled: threads.agentEnabled,
        evolvingKnowledgeEnabled: threads.evolvingKnowledgeEnabled,
        contextSummary: threads.contextSummary,
        contextSummaryUpdatedAt: threads.contextSummaryUpdatedAt,
        status: threads.status,
        createdAt: threads.createdAt,
        updatedAt: threads.updatedAt,
        messageCount: messageCountSubquery.as("message_count"),
        lastMessageContent: lastMessageSubquery.as("last_message_content"),
      })
      .from(threads)
      .where(and(...conditions))
      .orderBy(
        filters.sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn),
      )
      .all();

    return results as ThreadWithMessageCount[];
  },

  findById(id: string, userId?: number): Thread | undefined {
    const db = getDb();

    const conditions: any[] = [eq(threads.id, id)];

    if (userId !== undefined) {
      conditions.push(eq(threads.userId, userId));
    }

    return db
      .select()
      .from(threads)
      .where(and(...conditions))
      .limit(1)
      .get();
  },

  findByIdWithMessages(
    id: string,
    userId?: number,
  ): { thread: Thread; messages: Message[] } | null {
    const thread = this.findById(id, userId);
    if (!thread) {
      return null;
    }

    const db = getDb();
    const messagesResult = db
      .select()
      .from(messages)
      .where(eq(messages.threadId, id))
      .orderBy(asc(messages.createdAt), sql`rowid asc`)
      .all();

    return { thread, messages: messagesResult };
  },

  create(data: Omit<NewThread, "id" | "createdAt" | "updatedAt">): Thread {
    const db = getDb();
    const now = nowIso();
    return db
      .insert(threads)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  },

  updateById(
    id: string,
    data: Partial<Omit<NewThread, "id" | "createdAt">>,
  ): Thread | undefined {
    const db = getDb();
    return db
      .update(threads)
      .set({
        ...data,
        updatedAt: nowIso(),
      })
      .where(eq(threads.id, id))
      .returning()
      .get();
  },

  deleteById(id: string): boolean {
    const db = getDb();
    const result = db.delete(threads).where(eq(threads.id, id)).run();
    return result.changes > 0;
  },

  softDeleteById(id: string): Thread | undefined {
    return this.updateById(id, { status: "deleted" });
  },

  archiveById(id: string): Thread | undefined {
    return this.updateById(id, { status: "archived" });
  },

  restoreById(id: string): Thread | undefined {
    return this.updateById(id, { status: "active" });
  },
};

export const messageRepository = {
  listByThread(threadId: string): Message[] {
    const db = getDb();
    return db
      .select(selectMessageColumns)
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(asc(messages.createdAt), sql`rowid asc`)
      .all();
  },

  findById(id: string): Message | undefined {
    const db = getDb();
    return db
      .select(selectMessageColumns)
      .from(messages)
      .where(eq(messages.id, id))
      .limit(1)
      .get();
  },

  create(data: Omit<NewMessage, "id" | "createdAt">): Message {
    const db = getDb();
    return db
      .insert(messages)
      .values({
        ...data,
        createdAt: nowIso(),
      })
      .returning(selectMessageColumns)
      .get();
  },

  createBatch(
    threadId: string,
    items: Array<Omit<NewMessage, "id" | "threadId" | "createdAt">>,
  ): Message[] {
    const db = getDb();
    const now = nowIso();
    return db
      .insert(messages)
      .values(
        items.map((item) => ({
          ...item,
          threadId,
          createdAt: now,
        })),
      )
      .returning(selectMessageColumns)
      .all();
  },

  updateById(
    id: string,
    data: Partial<Omit<NewMessage, "id" | "threadId" | "createdAt">>,
  ): Message | undefined {
    const db = getDb();
    return db
      .update(messages)
      .set(data)
      .where(eq(messages.id, id))
      .returning(selectMessageColumns)
      .get();
  },

  deleteById(id: string): boolean {
    const db = getDb();
    const result = db.delete(messages).where(eq(messages.id, id)).run();
    return result.changes > 0;
  },

  deleteByThread(threadId: string): number {
    const db = getDb();
    const result = db
      .delete(messages)
      .where(eq(messages.threadId, threadId))
      .run();
    return result.changes;
  },
};
