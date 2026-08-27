import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, threads } from "@/db/schema";

export type RemoteWorkspaceThreadStatus = "active" | "archived";

export interface RemoteWorkspaceThreadCursor {
  updatedAt: string;
  id: string;
}

export interface RemoteWorkspaceThreadPageInput {
  userId: number;
  workspaceId: string;
  status: RemoteWorkspaceThreadStatus;
  limit: number;
  cursor?: RemoteWorkspaceThreadCursor;
}

export interface RemoteWorkspaceThreadRow {
  id: string;
  title: string;
  modelName: string | null;
  workspaceId: string | null;
  knowledgeBaseId: string | null;
  roleId: string | null;
  agentEnabled: boolean | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessageContent: string | null;
}

const buildConditions = (input: {
  userId: number;
  workspaceId: string;
  status: RemoteWorkspaceThreadStatus;
  cursor?: RemoteWorkspaceThreadCursor;
}) => {
  const conditions = [
    eq(threads.userId, input.userId),
    eq(threads.workspaceId, input.workspaceId),
    eq(threads.status, input.status),
  ];

  if (input.cursor) {
    conditions.push(sql`(
      ${threads.updatedAt} < ${input.cursor.updatedAt}
      OR (
        ${threads.updatedAt} = ${input.cursor.updatedAt}
        AND ${threads.id} < ${input.cursor.id}
      )
    )`);
  }

  return conditions;
};

export const remoteWorkspaceThreadRepository = {
  listPage(input: RemoteWorkspaceThreadPageInput): RemoteWorkspaceThreadRow[] {
    const db = getDb();
    const messageCountSubquery = sql<number>`(
      SELECT COUNT(*) FROM messages WHERE ${messages.threadId} = ${threads.id}
    )`;
    const lastMessageSubquery = sql<string | null>`(
      SELECT content FROM messages
      WHERE ${messages.threadId} = ${threads.id}
      ORDER BY created_at DESC, rowid DESC LIMIT 1
    )`;

    return db
      .select({
        id: threads.id,
        title: threads.title,
        modelName: threads.modelName,
        workspaceId: threads.workspaceId,
        knowledgeBaseId: threads.knowledgeBaseId,
        roleId: threads.roleId,
        agentEnabled: threads.agentEnabled,
        status: threads.status,
        createdAt: threads.createdAt,
        updatedAt: threads.updatedAt,
        messageCount: messageCountSubquery.as("message_count"),
        lastMessageContent: lastMessageSubquery.as("last_message_content"),
      })
      .from(threads)
      .where(and(...buildConditions(input)))
      .orderBy(desc(threads.updatedAt), desc(threads.id))
      .limit(input.limit)
      .all() as RemoteWorkspaceThreadRow[];
  },

  count(input: {
    userId: number;
    workspaceId: string;
    status: RemoteWorkspaceThreadStatus;
  }): number {
    const db = getDb();
    const row = db
      .select({ count: sql<number>`COUNT(*)` })
      .from(threads)
      .where(and(...buildConditions(input)))
      .get();

    return Number(row?.count ?? 0);
  },
};
