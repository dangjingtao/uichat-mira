import { and, asc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { integrationCapabilities, wecomSettings } from "../schema";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";
import {
  integrationInstancesRepository,
  type IntegrationProvider,
} from "./integration-instances.repository.js";

export type IntegrationCapabilityType =
  | "wecom.smart_robot"
  | "wecom.webhook_robot"
  | "wecom.sales_agent"
  | "lark.bot"
  | "lark.webhook"
  | "lark.knowledge_source";

export type IntegrationCapabilityRecord = {
  id: string;
  instanceId: string;
  provider: IntegrationProvider;
  type: IntegrationCapabilityType;
  name: string;
  enabled: boolean;
  knowledgeBaseId: string | null;
  config: Record<string, unknown>;
  runtime: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type IntegrationCapabilityInput = Partial<
  Omit<IntegrationCapabilityRecord, "id" | "createdAt" | "updatedAt">
>;

const normalizeText = (value: string) => value.trim();

const parseJson = (value: string, fallback: Record<string, unknown>) => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return fallback;
  }
};

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS integration_capabilities (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      instance_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      knowledge_base_id TEXT,
      config_json_encrypted TEXT,
      runtime_json TEXT NOT NULL DEFAULT '{}',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(instance_id) REFERENCES integration_instances(id) ON DELETE CASCADE
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_integration_capabilities_instance
    ON integration_capabilities(instance_id)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_integration_capabilities_provider
    ON integration_capabilities(provider)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_integration_capabilities_type
    ON integration_capabilities(type)
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_capabilities_instance_default
    ON integration_capabilities(instance_id, is_default)
    WHERE is_default = 1
  `);
};

const toRecord = (
  row: typeof integrationCapabilities.$inferSelect,
): IntegrationCapabilityRecord => ({
  id: row.id,
  instanceId: row.instanceId,
  provider: row.provider as IntegrationProvider,
  type: row.type as IntegrationCapabilityType,
  name: normalizeText(row.name),
  enabled: Boolean(row.enabled),
  knowledgeBaseId: row.knowledgeBaseId ?? null,
  config: parseJson(decryptSecret(row.configJsonEncrypted ?? null) || "{}", {}),
  runtime: parseJson(row.runtimeJson ?? "{}", {}),
  isDefault: Boolean(row.isDefault),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const clearDefaultIfNeeded = (instanceId: string, nextIsDefault: boolean) => {
  if (!nextIsDefault) {
    return;
  }

  getDb()
    .update(integrationCapabilities)
    .set({ isDefault: false, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(integrationCapabilities.instanceId, instanceId),
        eq(integrationCapabilities.isDefault, true),
      ),
    )
    .run();
};

const migrateWecomCapabilitiesFromLegacySettings = () => {
  const defaultInstance = integrationInstancesRepository.getDefault("wecom");
  if (!defaultInstance) {
    return;
  }

  const db = getDb();
  const existing = db
    .select()
    .from(integrationCapabilities)
    .where(eq(integrationCapabilities.instanceId, defaultInstance.id))
    .all();
  if (existing.length > 0) {
    return;
  }

  const legacy = db.select().from(wecomSettings).limit(1).get();
  if (!legacy) {
    return;
  }

  if (legacy.robotWebhookUrlEncrypted) {
    db.insert(integrationCapabilities)
      .values({
        instanceId: defaultInstance.id,
        provider: "wecom",
        type: "wecom.webhook_robot",
        name: "Default Webhook Robot",
        enabled: true,
        isDefault: true,
        configJsonEncrypted: encryptSecret(
          JSON.stringify({
            webhookUrl: decryptSecret(legacy.robotWebhookUrlEncrypted ?? null) || "",
            webhookSecret:
              decryptSecret(legacy.robotWebhookSecretEncrypted ?? null) || "",
          }),
        ),
      })
      .run();
  }

  if (legacy.smartRobotBotIdEncrypted || legacy.smartRobotSecretEncrypted) {
    const hasDefault = db
      .select()
      .from(integrationCapabilities)
      .where(
        and(
          eq(integrationCapabilities.instanceId, defaultInstance.id),
          eq(integrationCapabilities.isDefault, true),
        ),
      )
      .get();

    db.insert(integrationCapabilities)
      .values({
        instanceId: defaultInstance.id,
        provider: "wecom",
        type: "wecom.smart_robot",
        name: "Default Smart Robot",
        enabled: true,
        isDefault: !hasDefault,
        knowledgeBaseId:
          decryptSecret(legacy.smartRobotKnowledgeBaseIdEncrypted ?? null) || null,
        configJsonEncrypted: encryptSecret(
          JSON.stringify({
            botId:
              decryptSecret(legacy.smartRobotBotIdEncrypted ?? null) || "",
            secret:
              decryptSecret(legacy.smartRobotSecretEncrypted ?? null) || "",
            replyMode: legacy.smartRobotReplyMode === "send" ? "send" : "stream",
          }),
        ),
      })
      .run();
  }
};

export const integrationCapabilitiesRepository = {
  initialize() {
    ensureTable();
    migrateWecomCapabilitiesFromLegacySettings();
  },

  listByInstance(instanceId: string) {
    return getDb()
      .select()
      .from(integrationCapabilities)
      .where(eq(integrationCapabilities.instanceId, instanceId))
      .orderBy(
        asc(integrationCapabilities.provider),
        asc(integrationCapabilities.type),
        asc(integrationCapabilities.createdAt),
      )
      .all()
      .map(toRecord);
  },

  getById(id: string) {
    const row = getDb()
      .select()
      .from(integrationCapabilities)
      .where(eq(integrationCapabilities.id, id))
      .get();
    return row ? toRecord(row) : null;
  },

  create(input: IntegrationCapabilityInput) {
    if (!input.instanceId || !input.type || !input.provider) {
      throw new Error("instanceId, provider and type are required");
    }

    clearDefaultIfNeeded(input.instanceId, Boolean(input.isDefault));

    const row = getDb()
      .insert(integrationCapabilities)
      .values({
        instanceId: input.instanceId,
        provider: input.provider,
        type: input.type,
        name: normalizeText(input.name ?? ""),
        enabled: input.enabled ?? true,
        knowledgeBaseId: input.knowledgeBaseId ?? null,
        configJsonEncrypted: encryptSecret(JSON.stringify(input.config ?? {})),
        runtimeJson: JSON.stringify(input.runtime ?? {}),
        isDefault: input.isDefault ?? false,
      })
      .returning()
      .get();

    return toRecord(row);
  },

  update(id: string, input: IntegrationCapabilityInput) {
    const current = this.getById(id);
    if (!current) {
      return null;
    }

    const next = {
      name:
        typeof input.name === "string" ? normalizeText(input.name) : current.name,
      enabled:
        typeof input.enabled === "boolean" ? input.enabled : current.enabled,
      knowledgeBaseId:
        typeof input.knowledgeBaseId === "string"
          ? normalizeText(input.knowledgeBaseId) || null
          : input.knowledgeBaseId === null
            ? null
            : current.knowledgeBaseId,
      config:
        typeof input.config === "object" && input.config
          ? input.config
          : current.config,
      runtime:
        typeof input.runtime === "object" && input.runtime
          ? input.runtime
          : current.runtime,
      isDefault:
        typeof input.isDefault === "boolean"
          ? input.isDefault
          : current.isDefault,
    };

    clearDefaultIfNeeded(current.instanceId, next.isDefault);

    const row = getDb()
      .update(integrationCapabilities)
      .set({
        name: next.name,
        enabled: next.enabled,
        knowledgeBaseId: next.knowledgeBaseId,
        configJsonEncrypted: encryptSecret(JSON.stringify(next.config)),
        runtimeJson: JSON.stringify(next.runtime),
        isDefault: next.isDefault,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(integrationCapabilities.id, id))
      .returning()
      .get();

    return toRecord(row);
  },

  delete(id: string) {
    const current = this.getById(id);
    if (!current) {
      return false;
    }

    getDb()
      .delete(integrationCapabilities)
      .where(eq(integrationCapabilities.id, id))
      .run();

    return true;
  },
};
