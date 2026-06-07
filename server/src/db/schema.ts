/**
 * Drizzle ORM Schema 定义
 */
import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

// ==================== 用户表 ====================
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
}, (table) => ({
  usernameIdx: uniqueIndex("idx_users_username").on(table.username),
}));

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// ==================== 会话表 ====================
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// ==================== 模型配置表 ====================
export const modelConfigs = sqliteTable("model_configs", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  type: text("type", { enum: ["llm", "embedding", "rerank"] }).notNull(),
  name: text("name").notNull().default(""),
  params: text("params").notNull().default("{}"),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
}, (table) => ({
  typeIdx: index("idx_model_configs_type").on(table.type),
  typeDefaultIdx: uniqueIndex("idx_model_configs_type_default").on(table.type, table.isDefault),
}));

export const modelConfigsRelations = relations(modelConfigs, () => ({}));

export type ModelConfig = typeof modelConfigs.$inferSelect;
export type NewModelConfig = typeof modelConfigs.$inferInsert;

// ==================== 参数模板表 ====================
export const modelParamTemplates = sqliteTable("model_param_templates", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
  modelType: text("model_type", { enum: ["llm", "embedding", "rerank"] }).notNull(),
  paramKey: text("param_key").notNull(),
  paramLabel: text("param_label").notNull(),
  paramType: text("param_type", { enum: ["number", "select", "boolean"] }).notNull(),
  step: real("step"),
  options: text("options"),
  defaultValue: text("default_value").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
}, (table) => ({
  modelTypeParamKeyIdx: uniqueIndex("idx_model_param_templates_type_key").on(table.modelType, table.paramKey),
  modelTypeIdx: index("idx_model_param_templates_type").on(table.modelType),
}));

export const modelParamTemplatesRelations = relations(modelParamTemplates, () => ({}));

export type ModelParamTemplate = typeof modelParamTemplates.$inferSelect;
export type NewModelParamTemplate = typeof modelParamTemplates.$inferInsert;

// ==================== 类型导出 ====================
export type ModelType = "llm" | "embedding" | "rerank";
export type UserRole = "admin" | "user";
export type ParamType = "number" | "select" | "boolean";
