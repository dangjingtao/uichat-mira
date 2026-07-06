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
  ROLE_STATUS_VALUES,
  THREAD_STATUS_VALUES,
  USER_ROLE_VALUES,
} from "@/constants/domain.js";
import {
  PROVIDER_CODE_VALUES,
  PROVIDER_TEMPLATE_CODE_VALUES,
  PROVIDER_STATUS_VALUES,
  type ProviderCodeValue,
  type ProviderTemplateCodeValue,
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
    providerConnectionId: text("provider_connection_id").references(
      () => providerConnections.id,
      { onDelete: "set null" },
    ),
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
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    templateCode: text("template_code", {
      enum: PROVIDER_TEMPLATE_CODE_VALUES,
    }).notNull(),
    providerCode: text("provider_code", {
      enum: PROVIDER_CODE_VALUES,
    }),
    displayName: text("display_name").notNull(),
    baseUrl: text("base_url").notNull().default(""),
    apiKeyEncrypted: text("api_key_encrypted"),
    isSystem: integer("is_system", { mode: "boolean" })
      .notNull()
      .default(false),
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
    templateIdx: index("idx_provider_connections_template").on(table.templateCode),
    legacyProviderCodeUniqueIdx: uniqueIndex(
      "idx_provider_connections_provider_code_unique",
    )
      .on(table.providerCode)
      .where(sql`${table.providerCode} IS NOT NULL`),
  }),
);

export type ProviderConnection = typeof providerConnections.$inferSelect;
export type NewProviderConnection = typeof providerConnections.$inferInsert;

export const providerModels = sqliteTable(
  "provider_models",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    providerConnectionId: text("provider_connection_id")
      .notNull()
      .references(() => providerConnections.id, { onDelete: "cascade" }),
    providerCode: text("provider_code", {
      enum: PROVIDER_CODE_VALUES,
    }),
    remoteModelId: text("remote_model_id").notNull(),
    modelName: text("model_name").notNull(),
    rawPayloadJson: text("raw_payload_json"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    syncedAt: text("synced_at").notNull(),
  },
  (table) => ({
    providerModelUniqueIdx: uniqueIndex(
      "idx_provider_models_connection_remote",
    ).on(table.providerConnectionId, table.remoteModelId),
    providerModelIdx: index("idx_provider_models_connection").on(
      table.providerConnectionId,
    ),
    providerCodeIdx: index("idx_provider_models_provider_code").on(table.providerCode),
  }),
);

export type ProviderModel = typeof providerModels.$inferSelect;
export type NewProviderModel = typeof providerModels.$inferInsert;

export const webSearchSettings = sqliteTable("web_search_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tavilyApiKeyEncrypted: text("tavily_api_key_encrypted"),
  searxngBaseUrl: text("searxng_base_url").notNull().default(""),
  maxResults: integer("max_results").notNull().default(4),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type WebSearchSettings = typeof webSearchSettings.$inferSelect;
export type NewWebSearchSettings = typeof webSearchSettings.$inferInsert;

export const wecomSettings = sqliteTable("wecom_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  corpId: text("corp_id").notNull().default(""),
  agentId: text("agent_id").notNull().default(""),
  appSecretEncrypted: text("app_secret_encrypted"),
  contactsSecretEncrypted: text("contacts_secret_encrypted"),
  robotWebhookUrlEncrypted: text("robot_webhook_url_encrypted"),
  robotWebhookSecretEncrypted: text("robot_webhook_secret_encrypted"),
  smartRobotBotIdEncrypted: text("smart_robot_bot_id_encrypted"),
  smartRobotSecretEncrypted: text("smart_robot_secret_encrypted"),
  smartRobotKnowledgeBaseIdEncrypted: text(
    "smart_robot_knowledge_base_id_encrypted",
  ),
  smartRobotReplyMode: text("smart_robot_reply_mode").notNull().default("stream"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type WecomSettings = typeof wecomSettings.$inferSelect;
export type NewWecomSettings = typeof wecomSettings.$inferInsert;

export const integrationInstances = sqliteTable(
  "integration_instances",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    provider: text("provider").notNull(),
    name: text("name").notNull().default(""),
    externalTenantId: text("external_tenant_id"),
    configJsonEncrypted: text("config_json_encrypted"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    providerIdx: index("idx_integration_instances_provider").on(table.provider),
    defaultIdx: uniqueIndex("idx_integration_instances_provider_default")
      .on(table.provider, table.isDefault)
      .where(sql`${table.isDefault} = 1`),
    enabledIdx: index("idx_integration_instances_enabled").on(table.enabled),
  }),
);

export type IntegrationInstance = typeof integrationInstances.$inferSelect;
export type NewIntegrationInstance = typeof integrationInstances.$inferInsert;

export const integrationCapabilities = sqliteTable(
  "integration_capabilities",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    instanceId: text("instance_id")
      .notNull()
      .references(() => integrationInstances.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    type: text("type").notNull(),
    name: text("name").notNull().default(""),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    knowledgeBaseId: text("knowledge_base_id").references(() => knowledgeBases.id, {
      onDelete: "set null",
    }),
    configJsonEncrypted: text("config_json_encrypted"),
    runtimeJson: text("runtime_json").notNull().default("{}"),
    isDefault: integer("is_default", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    instanceIdx: index("idx_integration_capabilities_instance").on(table.instanceId),
    providerIdx: index("idx_integration_capabilities_provider").on(table.provider),
    typeIdx: index("idx_integration_capabilities_type").on(table.type),
    instanceDefaultIdx: uniqueIndex(
      "idx_integration_capabilities_instance_default",
    )
      .on(table.instanceId, table.isDefault)
      .where(sql`${table.isDefault} = 1`),
  }),
);

export type IntegrationCapability = typeof integrationCapabilities.$inferSelect;
export type NewIntegrationCapability = typeof integrationCapabilities.$inferInsert;

export const microApps = sqliteTable(
  "micro_app_definitions",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    type: text("type").notNull(),
    name: text("name").notNull().default(""),
    description: text("description").notNull().default(""),
    supportedAccessPointsJson: text("supported_access_points_json")
      .notNull()
      .default("[]"),
    bindingSchemaJson: text("binding_schema_json").notNull().default("{\"fields\":[]}"),
    runtimeKey: text("runtime_key").notNull().default(""),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    typeIdx: index("idx_micro_apps_type").on(table.type),
    enabledIdx: index("idx_micro_apps_enabled").on(table.enabled),
    typeUniqueIdx: uniqueIndex("idx_micro_apps_type_unique").on(table.type),
  }),
);

export type MicroApp = typeof microApps.$inferSelect;
export type NewMicroApp = typeof microApps.$inferInsert;

export const integrationCapabilityMicroApps = sqliteTable(
  "integration_capability_micro_app_bindings",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    capabilityId: text("capability_id")
      .notNull()
      .references(() => integrationCapabilities.id, { onDelete: "cascade" }),
    microAppDefinitionId: text("micro_app_definition_id")
      .notNull()
      .references(() => microApps.id, { onDelete: "cascade" }),
    bindingConfigJsonEncrypted: text("binding_config_json_encrypted"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    capabilityIdx: uniqueIndex("idx_integration_capability_micro_apps_capability").on(
      table.capabilityId,
    ),
    microAppIdx: index("idx_integration_capability_micro_apps_micro_app").on(
      table.microAppDefinitionId,
    ),
  }),
);

export type IntegrationCapabilityMicroApp =
  typeof integrationCapabilityMicroApps.$inferSelect;
export type NewIntegrationCapabilityMicroApp =
  typeof integrationCapabilityMicroApps.$inferInsert;

export const mailAccounts = sqliteTable(
  "mail_accounts",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default(""),
    emailAddress: text("email_address").notNull().default(""),
    smtpHost: text("smtp_host").notNull().default(""),
    smtpPort: integer("smtp_port").notNull().default(587),
    smtpSecure: integer("smtp_secure", { mode: "boolean" }).notNull().default(false),
    smtpUsername: text("smtp_username").notNull().default(""),
    smtpPasswordEncrypted: text("smtp_password_encrypted"),
    imapHost: text("imap_host").notNull().default(""),
    imapPort: integer("imap_port").notNull().default(993),
    imapSecure: integer("imap_secure", { mode: "boolean" }).notNull().default(true),
    imapUsername: text("imap_username").notNull().default(""),
    imapPasswordEncrypted: text("imap_password_encrypted"),
    inboxFolderPath: text("inbox_folder_path").notNull().default("INBOX"),
    status: text("status", { enum: ["idle", "connected", "error"] })
      .notNull()
      .default("idle"),
    lastError: text("last_error"),
    lastSyncedAt: text("last_synced_at"),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdx: index("idx_mail_accounts_user_id").on(table.userId),
    statusIdx: index("idx_mail_accounts_status").on(table.status),
    defaultIdx: uniqueIndex("idx_mail_accounts_user_default")
      .on(table.userId, table.isDefault)
      .where(sql`${table.isDefault} = 1`),
  }),
);

export type MailAccount = typeof mailAccounts.$inferSelect;
export type NewMailAccount = typeof mailAccounts.$inferInsert;

export const mailFolders = sqliteTable(
  "mail_folders",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    accountId: text("account_id")
      .notNull()
      .references(() => mailAccounts.id, { onDelete: "cascade" }),
    folderKey: text("folder_key").notNull().default("inbox"),
    folderName: text("folder_name").notNull().default("Inbox"),
    folderPath: text("folder_path").notNull().default("INBOX"),
    messageCount: integer("message_count").notNull().default(0),
    unreadCount: integer("unread_count").notNull().default(0),
    syncStatus: text("sync_status", {
      enum: ["idle", "syncing", "succeeded", "failed"],
    })
      .notNull()
      .default("idle"),
    lastSyncedAt: text("last_synced_at"),
    lastError: text("last_error"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    accountIdx: index("idx_mail_folders_account_id").on(table.accountId),
    uniqueFolderIdx: uniqueIndex("idx_mail_folders_account_folder_key").on(
      table.accountId,
      table.folderKey,
    ),
  }),
);

export type MailFolder = typeof mailFolders.$inferSelect;
export type NewMailFolder = typeof mailFolders.$inferInsert;

export const mailMessages = sqliteTable(
  "mail_messages",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    accountId: text("account_id")
      .notNull()
      .references(() => mailAccounts.id, { onDelete: "cascade" }),
    folderId: text("folder_id")
      .notNull()
      .references(() => mailFolders.id, { onDelete: "cascade" }),
    remoteUid: integer("remote_uid").notNull(),
    messageId: text("message_id"),
    subject: text("subject").notNull().default(""),
    fromDisplay: text("from_display").notNull().default(""),
    fromAddress: text("from_address").notNull().default(""),
    toJson: text("to_json").notNull().default("[]"),
    previewText: text("preview_text").notNull().default(""),
    textContent: text("text_content").notNull().default(""),
    htmlContent: text("html_content").notNull().default(""),
    sentAt: text("sent_at"),
    receivedAt: text("received_at"),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    isFlagged: integer("is_flagged", { mode: "boolean" }).notNull().default(false),
    hasAttachments: integer("has_attachments", { mode: "boolean" })
      .notNull()
      .default(false),
    rawHeadersJson: text("raw_headers_json").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    folderReceivedIdx: index("idx_mail_messages_folder_received").on(
      table.folderId,
      table.receivedAt,
    ),
    accountIdx: index("idx_mail_messages_account_id").on(table.accountId),
    uniqueRemoteUidIdx: uniqueIndex("idx_mail_messages_folder_remote_uid").on(
      table.folderId,
      table.remoteUid,
    ),
  }),
);

export type MailMessage = typeof mailMessages.$inferSelect;
export type NewMailMessage = typeof mailMessages.$inferInsert;

export const externalIdentityBindings = sqliteTable(
  "external_identity_bindings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalUserId: text("external_user_id").notNull(),
    externalUnionId: text("external_union_id"),
    bindSource: text("bind_source").notNull().default("manual"),
    bindStatus: text("bind_status").notNull().default("bound"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    providerUserUniqueIdx: uniqueIndex("idx_external_identity_bindings_provider_user").on(
      table.provider,
      table.userId,
    ),
    providerExternalUserUniqueIdx: uniqueIndex(
      "idx_external_identity_bindings_provider_external_user",
    ).on(table.provider, table.externalUserId),
    userIdIdx: index("idx_external_identity_bindings_user_id").on(table.userId),
    providerIdx: index("idx_external_identity_bindings_provider").on(table.provider),
  }),
);

export type ExternalIdentityBinding = typeof externalIdentityBindings.$inferSelect;
export type NewExternalIdentityBinding = typeof externalIdentityBindings.$inferInsert;

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
    metadataJson: text("metadata_json").notNull().default("{}"),
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

export const roles = sqliteTable(
  "roles",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    summary: text("summary").notNull().default(""),
    avatarId: text("avatar_id"),
    status: text("status", { enum: ROLE_STATUS_VALUES })
      .notNull()
      .default("draft"),
    tagsJson: text("tags_json").notNull().default("[]"),
    promptJson: text("prompt_json").notNull().default("{}"),
    llmProfileJson: text("llm_profile_json").notNull().default("{}"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userIdIdx: index("idx_roles_user_id").on(table.userId),
    statusIdx: index("idx_roles_status").on(table.status),
    updatedAtIdx: index("idx_roles_updated_at").on(table.updatedAt),
  }),
);

export const rolesRelations = relations(roles, ({ one }) => ({
  user: one(users, {
    fields: [roles.userId],
    references: [users.id],
  }),
}));

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export const chatWorkspaces = sqliteTable(
  "chat_workspaces",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rootPath: text("root_path"),
    status: text("status", { enum: ["active", "archived"] })
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
    userIdIdx: index("idx_chat_workspaces_user_id").on(table.userId),
    statusIdx: index("idx_chat_workspaces_status").on(table.status),
    updatedAtIdx: index("idx_chat_workspaces_updated_at").on(table.updatedAt),
  }),
);

export type ChatWorkspace = typeof chatWorkspaces.$inferSelect;
export type NewChatWorkspace = typeof chatWorkspaces.$inferInsert;

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
    workspaceId: text("workspace_id").references(() => chatWorkspaces.id, {
      onDelete: "set null",
    }),
    knowledgeBaseId: text("knowledge_base_id")
      .references(() => knowledgeBases.id, { onDelete: "cascade" }),
    roleId: text("role_id").references(() => roles.id, {
      onDelete: "set null",
    }),
    agentEnabled: integer("agent_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    contextSummary: text("context_summary"),
    contextSummaryUpdatedAt: text("context_summary_updated_at"),
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
    workspaceIdx: index("idx_threads_workspace_id").on(table.workspaceId),
    knowledgeBaseIdx: index("idx_threads_knowledge_base").on(table.knowledgeBaseId),
    roleIdx: index("idx_threads_role_id").on(table.roleId),
    statusIdx: index("idx_threads_status").on(table.status),
    updatedAtIdx: index("idx_threads_updated_at").on(table.updatedAt),
  }),
);

export const threadsRelations = relations(threads, ({ many, one }) => ({
  messages: many(messages),
  workspace: one(chatWorkspaces, {
    fields: [threads.workspaceId],
    references: [chatWorkspaces.id],
  }),
  knowledgeBase: one(knowledgeBases, {
    fields: [threads.knowledgeBaseId],
    references: [knowledgeBases.id],
  }),
  role: one(roles, {
    fields: [threads.roleId],
    references: [roles.id],
  }),
  user: one(users, {
    fields: [threads.userId],
    references: [users.id],
  }),
}));

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;

export const chatWorkspacesRelations = relations(
  chatWorkspaces,
  ({ many, one }) => ({
    threads: many(threads),
    user: one(users, {
      fields: [chatWorkspaces.userId],
      references: [users.id],
    }),
  }),
);

export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id")
      .primaryKey()
      .default(sql`(lower(hex(randomblob(16))))`),
    threadId: text("thread_id").notNull(),
    userId: integer("user_id").notNull(),
    goalJson: text("goal_json").notNull(),
    planJson: text("plan_json").notNull(),
    status: text("status", {
      enum: [
        "queued",
        "running",
        "waiting_approval",
        "waiting_user",
        "completed",
        "failed",
        "blocked",
        "cancelled",
      ],
    })
      .notNull()
      .default("queued"),
    observationsJson: text("observations_json").notNull().default("[]"),
    traceId: text("trace_id").notNull(),
    currentStepId: text("current_step_id"),
    blockedReason: text("blocked_reason"),
    terminalReason: text("terminal_reason"),
    pendingApprovalJson: text("pending_approval_json"),
    approvedInvocationsJson: text("approved_invocations_json").notNull().default("[]"),
    contextBudgetJson: text("context_budget_json"),
    selectedToolId: text("selected_tool_id"),
    pendingToolCallJson: text("pending_tool_call_json"),
    lastToolExecutionJson: text("last_tool_execution_json"),
    assistantMessageId: text("assistant_message_id"),
    assistantParentId: text("assistant_parent_id"),
    runtimeInputJson: text("runtime_input_json"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    threadIdx: index("idx_agent_runs_thread_id").on(table.threadId),
    userIdx: index("idx_agent_runs_user_id").on(table.userId),
    statusIdx: index("idx_agent_runs_status").on(table.status),
    traceIdx: index("idx_agent_runs_trace_id").on(table.traceId),
    updatedAtIdx: index("idx_agent_runs_updated_at").on(table.updatedAt),
  }),
);

export type AgentRunRow = typeof agentRuns.$inferSelect;
export type NewAgentRunRow = typeof agentRuns.$inferInsert;

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
    partsJson: text("parts_json"),
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

export type ModelType =
  | "llm"
  | "embedding"
  | "rerank"
  | "task"
  | "agentTask"
  | "evaluation"
  | "imageGeneration";
export type UserRole = "admin" | "user";
export type ParamType = "number" | "select" | "boolean";
export type ProviderCode = ProviderCodeValue;
export type ProviderTemplateCode = ProviderTemplateCodeValue;
export type ProviderStatus = ProviderStatusValue;
export type KnowledgeBaseStatus = "active" | "archived";
export type DocumentSourceType = "upload" | "sync" | "api";
export type DocumentIndexStatus = "processing" | "ready" | "failed";
export type VectorDistanceMetric = "cosine" | "l2" | "inner_product";
export type RoleStatus = "active" | "draft";
export type ThreadStatus = "active" | "archived" | "deleted";
export type MessageRole = "user" | "assistant" | "system";
