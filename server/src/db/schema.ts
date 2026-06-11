import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import {
  MESSAGE_ROLE_VALUES,
  MODEL_TYPE_VALUES,
  THREAD_STATUS_VALUES,
  USER_ROLE_VALUES,
} from "@/constants/domain.js";
import {
  PROVIDER_CODE_VALUES,
  PROVIDER_STATUS_VALUES,
  type ProviderCodeValue,
  type ProviderStatusValue,
} from "@/providers/codes.js";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: USER_ROLE_VALUES }).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
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
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
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
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    type: text("type", { enum: MODEL_TYPE_VALUES }).notNull(),
    name: text("name").notNull().default(""),
    providerCode: text("provider_code", {
      enum: PROVIDER_CODE_VALUES,
    }),
    remoteModelId: text("remote_model_id"),
    params: text("params").notNull().default("{}"),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    typeIdx: index("idx_model_configs_type").on(table.type),
    typeDefaultIdx: uniqueIndex("idx_model_configs_type_default")
      .on(table.type)
      .where(sql`${table.isDefault} = 1`),
  }),
);

export const modelConfigsRelations = relations(modelConfigs, () => ({}));

export type ModelConfig = typeof modelConfigs.$inferSelect;
export type NewModelConfig = typeof modelConfigs.$inferInsert;

export const modelParamTemplates = sqliteTable(
  "model_param_templates",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    modelType: text("model_type", {
      enum: MODEL_TYPE_VALUES,
    }).notNull(),
    paramKey: text("param_key").notNull(),
    paramLabel: text("param_label").notNull(),
    paramType: text("param_type", {
      enum: ["number", "select", "boolean"],
    }).notNull(),
    step: real("step"),
    options: text("options"),
    defaultValue: text("default_value").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    modelTypeParamKeyIdx: uniqueIndex("idx_model_param_templates_type_key").on(
      table.modelType,
      table.paramKey,
    ),
    modelTypeIdx: index("idx_model_param_templates_type").on(table.modelType),
  }),
);

export const modelParamTemplatesRelations = relations(
  modelParamTemplates,
  () => ({}),
);

export type ModelParamTemplate = typeof modelParamTemplates.$inferSelect;
export type NewModelParamTemplate = typeof modelParamTemplates.$inferInsert;

export const providerConnections = sqliteTable(
  "provider_connections",
  {
    providerCode: text("provider_code", {
      enum: PROVIDER_CODE_VALUES,
    }).primaryKey(),
    displayName: text("display_name").notNull(),
    baseUrl: text("base_url").notNull().default(""),
    apiKeyEncrypted: text("api_key_encrypted"),
    isEnabled: integer("is_enabled", { mode: "boolean" })
      .notNull()
      .default(true),
    status: text("status", {
      enum: PROVIDER_STATUS_VALUES,
    })
      .notNull()
      .default("idle"),
    lastError: text("last_error"),
    lastSyncedAt: text("last_synced_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    providerStatusIdx: index("idx_provider_connections_status").on(
      table.status,
    ),
  }),
);

export type ProviderConnection = typeof providerConnections.$inferSelect;
export type NewProviderConnection = typeof providerConnections.$inferInsert;

export const providerModels = sqliteTable(
  "provider_models",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    providerCode: text("provider_code", {
      enum: PROVIDER_CODE_VALUES,
    }).notNull(),
    remoteModelId: text("remote_model_id").notNull(),
    modelName: text("model_name").notNull(),
    rawPayloadJson: text("raw_payload_json"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    syncedAt: text("synced_at").notNull(),
  },
  (table) => ({
    providerModelUniqueIdx: uniqueIndex(
      "idx_provider_models_provider_remote",
    ).on(table.providerCode, table.remoteModelId),
    providerModelIdx: index("idx_provider_models_provider").on(
      table.providerCode,
    ),
  }),
);

export type ProviderModel = typeof providerModels.$inferSelect;
export type NewProviderModel = typeof providerModels.$inferInsert;

export const knowledgeBases = sqliteTable(
  "knowledge_bases",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    embeddingModelConfigId: text("embedding_model_config_id").references(
      () => modelConfigs.id,
      { onDelete: "set null" },
    ),
    chunkingConfigJson: text("chunking_config_json").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    statusIdx: index("idx_knowledge_bases_status").on(table.status),
  }),
);

export const knowledgeBasesRelations = relations(
  knowledgeBases,
  ({ many, one }) => ({
    documents: many(documents),
    embeddingModelConfig: one(modelConfigs, {
      fields: [knowledgeBases.embeddingModelConfigId],
      references: [modelConfigs.id],
    }),
    vectorIndexes: many(knowledgeBaseVectorIndexes),
  }),
);

export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert;

export const documents = sqliteTable(
  "documents",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    knowledgeBaseId: text("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceType: text("source_type", { enum: ["upload", "sync", "api"] })
      .notNull()
      .default("upload"),
    sourceLabel: text("source_label"),
    fileExt: text("file_ext").notNull(),
    mimeType: text("mime_type"),
    fileSize: integer("file_size"),
    contentText: text("content_text").notNull().default(""),
    indexStatus: text("index_status", {
      enum: ["processing", "ready", "failed"],
    })
      .notNull()
      .default("processing"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    chunkCount: integer("chunk_count").notNull().default(0),
    charCount: integer("char_count").notNull().default(0),
    tokenCount: integer("token_count"),
    errorMessage: text("error_message"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    knowledgeBaseIdx: index("idx_documents_knowledge_base").on(
      table.knowledgeBaseId,
    ),
    statusIdx: index("idx_documents_index_status").on(table.indexStatus),
    enabledIdx: index("idx_documents_enabled").on(table.enabled),
    createdAtIdx: index("idx_documents_created_at").on(table.createdAt),
  }),
);

export const documentsRelations = relations(documents, ({ one, many }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [documents.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
  chunks: many(documentChunks),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;

export const documentChunks = sqliteTable(
  "document_chunks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    knowledgeBaseId: text("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    charCount: integer("char_count").notNull().default(0),
    tokenCount: integer("token_count"),
    startOffset: integer("start_offset"),
    endOffset: integer("end_offset"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    documentChunkUniqueIdx: uniqueIndex(
      "idx_document_chunks_document_index",
    ).on(table.documentId, table.chunkIndex),
    knowledgeBaseIdx: index("idx_document_chunks_knowledge_base").on(
      table.knowledgeBaseId,
    ),
    documentIdx: index("idx_document_chunks_document").on(table.documentId),
  }),
);

export const documentChunksRelations = relations(documentChunks, ({ one }) => ({
  knowledgeBase: one(knowledgeBases, {
    fields: [documentChunks.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
}));

export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;

export const knowledgeBaseVectorIndexes = sqliteTable(
  "knowledge_base_vector_indexes",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    knowledgeBaseId: text("knowledge_base_id")
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    tableName: text("table_name").notNull(),
    embeddingModelConfigId: text("embedding_model_config_id").references(
      () => modelConfigs.id,
      { onDelete: "set null" },
    ),
    dimensions: integer("dimensions").notNull(),
    distanceMetric: text("distance_metric", {
      enum: ["cosine", "l2", "inner_product"],
    })
      .notNull()
      .default("cosine"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    tableNameUniqueIdx: uniqueIndex("idx_kb_vector_indexes_table_name").on(
      table.tableName,
    ),
    knowledgeBaseIdx: index("idx_kb_vector_indexes_knowledge_base").on(
      table.knowledgeBaseId,
    ),
  }),
);

export const knowledgeBaseVectorIndexesRelations = relations(
  knowledgeBaseVectorIndexes,
  ({ one }) => ({
    knowledgeBase: one(knowledgeBases, {
      fields: [knowledgeBaseVectorIndexes.knowledgeBaseId],
      references: [knowledgeBases.id],
    }),
    embeddingModelConfig: one(modelConfigs, {
      fields: [knowledgeBaseVectorIndexes.embeddingModelConfigId],
      references: [modelConfigs.id],
    }),
  }),
);

export type KnowledgeBaseVectorIndex =
  typeof knowledgeBaseVectorIndexes.$inferSelect;
export type NewKnowledgeBaseVectorIndex =
  typeof knowledgeBaseVectorIndexes.$inferInsert;

export const threads = sqliteTable(
  "threads",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    modelName: text("model_name"),
    ragEnabled: integer("rag_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", { enum: THREAD_STATUS_VALUES })
      .notNull()
      .default("active"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index("idx_threads_user_id").on(table.userId),
    statusIdx: index("idx_threads_status").on(table.status),
    updatedAtIdx: index("idx_threads_updated_at").on(table.updatedAt),
  }),
);

export const threadsRelations = relations(threads, ({ many, one }) => ({
  messages: many(messages),
  user: one(users, {
    fields: [threads.userId],
    references: [users.id],
  }),
}));

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;

export const messages = sqliteTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    threadId: text("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    role: text("role", { enum: MESSAGE_ROLE_VALUES }).notNull(),
    content: text("content").notNull(),
    metadata: text("metadata").default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    threadIdIdx: index("idx_messages_thread_id").on(table.threadId),
    createdAtIdx: index("idx_messages_created_at").on(table.createdAt),
  }),
);

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(threads, {
    fields: [messages.threadId],
    references: [threads.id],
  }),
}));

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type ModelType = "llm" | "embedding" | "rerank" | "task";
export type UserRole = "admin" | "user";
export type ParamType = "number" | "select" | "boolean";
export type ProviderCode = ProviderCodeValue;
export type ProviderStatus = ProviderStatusValue;
export type KnowledgeBaseStatus = "active" | "archived";
export type DocumentSourceType = "upload" | "sync" | "api";
export type DocumentIndexStatus = "processing" | "ready" | "failed";
export type VectorDistanceMetric = "cosine" | "l2" | "inner_product";
export type ThreadStatus = "active" | "archived" | "deleted";
export type MessageRole = "user" | "assistant" | "system";
