import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  chatWorkspaces,
  type ChatWorkspace,
  type NewChatWorkspace,
} from "@/db/schema";
import { nowIso } from "@/utils/time.js";

export interface ChatWorkspaceListFilters {
  userId: number;
  status?: "active" | "archived";
  sortOrder?: "asc" | "desc";
}

export const chatWorkspaceRepository = {
  list(filters: ChatWorkspaceListFilters): ChatWorkspace[] {
    const db = getDb();
    const conditions = [eq(chatWorkspaces.userId, filters.userId)];

    if (filters.status) {
      conditions.push(eq(chatWorkspaces.status, filters.status));
    } else {
      conditions.push(eq(chatWorkspaces.status, "active"));
    }

    return db
      .select()
      .from(chatWorkspaces)
      .where(and(...conditions))
      .orderBy(
        filters.sortOrder === "asc"
          ? asc(chatWorkspaces.updatedAt)
          : desc(chatWorkspaces.updatedAt),
      )
      .all();
  },

  findById(id: string, userId?: number): ChatWorkspace | undefined {
    const db = getDb();
    const conditions = [eq(chatWorkspaces.id, id)];

    if (typeof userId === "number") {
      conditions.push(eq(chatWorkspaces.userId, userId));
    }

    return db
      .select()
      .from(chatWorkspaces)
      .where(and(...conditions))
      .limit(1)
      .get();
  },

  create(data: Omit<NewChatWorkspace, "id" | "createdAt" | "updatedAt">): ChatWorkspace {
    const db = getDb();
    const now = nowIso();

    return db
      .insert(chatWorkspaces)
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
    data: Partial<Omit<NewChatWorkspace, "id" | "createdAt">>,
  ): ChatWorkspace | undefined {
    const db = getDb();

    return db
      .update(chatWorkspaces)
      .set({
        ...data,
        updatedAt: nowIso(),
      })
      .where(eq(chatWorkspaces.id, id))
      .returning()
      .get();
  },

  deleteById(id: string): boolean {
    const db = getDb();
    const result = db.delete(chatWorkspaces).where(eq(chatWorkspaces.id, id)).run();
    return result.changes > 0;
  },
};
