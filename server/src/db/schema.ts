import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "user"] }).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => ({
    usernameIdx: uniqueIndex("idx_users_username").on(table.username),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
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

export const modelConfigs = sqliteTable(
  "model_configs",
  {
    id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
    type: text("type", { enum: ["llm", "embedding", "rerank"] }).notNull(),
    name: text("name").notNull().default(""),
    providerCode: text("provider_code", {
      enum: ["ollama", "lmstudio", "openai"],
    }),
    remoteModelId: text("remote_model_id"),
    params: text("params").notNull().default("{}"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => ({
    typeIdx: index("idx_model_configs_type").on(table.type),
    typeDefaultIdx: uniqueIndex("idx_model_configs_type_default").on(
      table.type,
      table.isDefault,
    ),
  }),
);

export const modelConfigsRelations = relations(modelConfigs, () => ({}));

export type ModelConfig = typeof modelConfigs.$inferSelect;
export type NewModelConfig = typeof modelConfigs.$inferInsert;

export const modelParamTemplates = sqliteTable(
  "model_param_templates",
  {
    id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16))))`),
    modelType: text("model_type", {
      enum: ["llm", "embedding", "rerank"],
    }).notNull(),
    paramKey: text("param_key").notNull(),
    paramLabel: text("param_label").notNull(),
    paramType: text("param_type", {
      enum: ["number", "select", "boolean"],
    }).notNull(),
    step: real("step"),
    options: text("options"),
    defaultValue: text("default_value").notNull(),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => ({
    modelTypeParamKeyIdx: uniqueIndex("idx_model_param_templates_type_key").on(
      table.modelType,
      table.paramKey,
    ),
    modelTypeIdx: index("idx_model_param_templates_type").on(table.modelType),
  }),
);

export const modelParamTemplatesRelations = relations(modelParamTemplates, () => ({}));

export type ModelParamTemplate = typeof modelParamTemplates.$inferSelect;
export type NewModelParamTemplate = typeof modelParamTemplates.$inferInsert;

export const providerConnections = sqliteTable(
  "provider_connections",
  {
    providerCode: text("provider_code", {
      enum: ["ollama", "lmstudio", "openai"],
    }).primaryKey(),
    displayName: text("display_name").notNull(),
    baseUrl: text("base_url").notNull().default(""),
    apiKeyEncrypted: text("api_key_encrypted"),
    isEnabled: integer("is_enabled", { mode: "boolean" }).notNull().default(true),
    status: text("status", {
      enum: ["idle", "syncing", "connected", "error"],
    }).notNull().default("idle"),
    lastError: text("last_error"),
    lastSyncedAt: text("last_synced_at"),
    createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
    updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  },
  (table) => ({
    providerStatusIdx: index("idx_provider_connections_status").on(table.status),
  }),
);

export type ProviderConnection = typeof providerConnections.$inferSelect;
export type NewProviderConnection = typeof providerConnections.$inferInsert;

export const providerModels = sqliteTable(
  "provider_models",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    providerCode: text("provider_code", {
      enum: ["ollama", "lmstudio", "openai"],
    }).notNull(),
    remoteModelId: text("remote_model_id").notNull(),
    modelName: text("model_name").notNull(),
    rawPayloadJson: text("raw_payload_json"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    syncedAt: text("synced_at").notNull(),
  },
  (table) => ({
    providerModelUniqueIdx: uniqueIndex("idx_provider_models_provider_remote").on(
      table.providerCode,
      table.remoteModelId,
    ),
    providerModelIdx: index("idx_provider_models_provider").on(table.providerCode),
  }),
);

export type ProviderModel = typeof providerModels.$inferSelect;
export type NewProviderModel = typeof providerModels.$inferInsert;

export type ModelType = "llm" | "embedding" | "rerank";
export type UserRole = "admin" | "user";
export type ParamType = "number" | "select" | "boolean";
export type ProviderCode = "ollama" | "lmstudio" | "openai";
export type ProviderStatus = "idle" | "syncing" | "connected" | "error";
