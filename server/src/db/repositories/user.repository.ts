/**
 * 用户数据访问层
 */
import { eq, and } from "drizzle-orm";
import { getDb } from "../index";
import { users } from "../schema";
import type { NewUser, User } from "../schema";

/**
 * 用户 Repository
 */
export const userRepository = {
  /**
   * 根据用户名查找用户
   */
  findByUsername(username: string): User | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1)
      .get();
    return result;
  },

  /**
   * 根据 ID 查找用户
   */
  findById(id: number): User | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
      .get();
    return result;
  },

  /**
   * 创建用户
   */
  create(data: Omit<NewUser, "id" | "createdAt">): User {
    const db = getDb();
    const result = db
      .insert(users)
      .values({
        ...data,
        isActive: data.isActive ?? true,
      })
      .returning()
      .get();
    return result;
  },

  /**
   * 更新用户
   */
  update(id: number, data: Partial<NewUser>): User | undefined {
    const db = getDb();
    const result = db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning()
      .get();
    return result;
  },

  /**
   * 删除用户
   */
  delete(id: number): boolean {
    const db = getDb();
    const result = db.delete(users).where(eq(users.id, id)).run();
    return result.changes > 0;
  },

  /**
   * 获取所有用户
   */
  findAll(): User[] {
    const db = getDb();
    return db.select().from(users).all();
  },

  /**
   * 根据用户名和密码查找用户（用于登录验证）
   */
  findActiveByUsername(username: string): User | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(users)
      .where(and(eq(users.username, username), eq(users.isActive, true)))
      .limit(1)
      .get();
    return result;
  },

  /**
   * 查找或创建用户（upsert）
   */
  findOrCreate(
    username: string,
    data: Omit<NewUser, "id" | "createdAt" | "username">,
  ): User {
    const existing = this.findByUsername(username);
    if (existing) {
      return this.update(existing.id, { ...data, isActive: true })!;
    }
    return this.create({ username, ...data });
  },
};
