import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { roles, type NewRole, type Role, type RoleStatus } from "@/db/schema";
import { nowIso } from "@/utils/time.js";

export interface RoleListFilters {
  userId: number;
  status?: RoleStatus;
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}

export const roleRepository = {
  list(filters: RoleListFilters): Role[] {
    const db = getDb();
    const conditions = [eq(roles.userId, filters.userId)];

    if (filters.status) {
      conditions.push(eq(roles.status, filters.status));
    }

    const orderColumn =
      filters.sortBy === "createdAt"
        ? roles.createdAt
        : filters.sortBy === "name"
          ? roles.name
          : roles.updatedAt;

    return db
      .select()
      .from(roles)
      .where(and(...conditions))
      .orderBy(
        filters.sortOrder === "asc" ? asc(orderColumn) : desc(orderColumn),
      )
      .all();
  },

  findById(id: string, userId?: number): Role | undefined {
    const db = getDb();
    const conditions = [eq(roles.id, id)];

    if (userId !== undefined) {
      conditions.push(eq(roles.userId, userId));
    }

    return db
      .select()
      .from(roles)
      .where(and(...conditions))
      .limit(1)
      .get();
  },

  create(data: Omit<NewRole, "id" | "createdAt" | "updatedAt">): Role {
    const db = getDb();
    const now = nowIso();
    return db
      .insert(roles)
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
    data: Partial<Omit<NewRole, "id" | "userId" | "createdAt">>,
  ): Role | undefined {
    const db = getDb();
    return db
      .update(roles)
      .set({
        ...data,
        updatedAt: nowIso(),
      })
      .where(eq(roles.id, id))
      .returning()
      .get();
  },

  deleteById(id: string): boolean {
    const db = getDb();
    const result = db.delete(roles).where(eq(roles.id, id)).run();
    return result.changes > 0;
  },
};
