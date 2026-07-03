import { and, desc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { integrationInstances, wecomSettings } from "../schema";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";

export type IntegrationProvider = "wecom" | "lark" | "dingtalk";

export type IntegrationInstanceRecord = {
  id: string;
  provider: IntegrationProvider;
  name: string;
  externalTenantId: string | null;
  config: Record<string, unknown>;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type IntegrationInstanceInput = Partial<
  Omit<IntegrationInstanceRecord, "id" | "createdAt" | "updatedAt">
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
    CREATE TABLE IF NOT EXISTS integration_instances (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      provider TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      external_tenant_id TEXT,
      config_json_encrypted TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_integration_instances_provider
    ON integration_instances(provider)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_integration_instances_enabled
    ON integration_instances(enabled)
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_instances_provider_default
    ON integration_instances(provider, is_default)
    WHERE is_default = 1
  `);
};

const toRecord = (
  row: typeof integrationInstances.$inferSelect,
): IntegrationInstanceRecord => ({
  id: row.id,
  provider: row.provider as IntegrationProvider,
  name: normalizeText(row.name),
  externalTenantId: row.externalTenantId ?? null,
  config: parseJson(decryptSecret(row.configJsonEncrypted ?? null) || "{}", {}),
  enabled: Boolean(row.enabled),
  isDefault: Boolean(row.isDefault),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const clearDefaultIfNeeded = (
  provider: IntegrationProvider,
  nextIsDefault: boolean,
) => {
  if (!nextIsDefault) {
    return;
  }

  getDb()
    .update(integrationInstances)
    .set({ isDefault: false, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(integrationInstances.provider, provider),
        eq(integrationInstances.isDefault, true),
      ),
    )
    .run();
};

const migrateDefaultWecomInstanceFromLegacySettings = () => {
  const db = getDb();
  const existing = db
    .select()
    .from(integrationInstances)
    .where(eq(integrationInstances.provider, "wecom"))
    .limit(1)
    .get();
  if (existing) {
    return;
  }

  const legacy = db.select().from(wecomSettings).limit(1).get();
  if (!legacy) {
    return;
  }

  db.insert(integrationInstances)
    .values({
      provider: "wecom",
      name: "Default WeCom Instance",
      externalTenantId: legacy.corpId ?? "",
      configJsonEncrypted: encryptSecret(
        JSON.stringify({
          corpId: legacy.corpId ?? "",
          agentId: legacy.agentId ?? "",
          appSecret: decryptSecret(legacy.appSecretEncrypted ?? null) || "",
          contactsSecret:
            decryptSecret(legacy.contactsSecretEncrypted ?? null) || "",
        }),
      ),
      enabled: true,
      isDefault: true,
    })
    .run();
};

export const integrationInstancesRepository = {
  initialize() {
    ensureTable();
    migrateDefaultWecomInstanceFromLegacySettings();
  },

  list(provider?: IntegrationProvider) {
    const base = getDb().select().from(integrationInstances);
    const rows = provider
      ? base
          .where(eq(integrationInstances.provider, provider))
          .orderBy(
            desc(integrationInstances.isDefault),
            desc(integrationInstances.updatedAt),
          )
          .all()
      : base
          .orderBy(
            desc(integrationInstances.provider),
            desc(integrationInstances.isDefault),
            desc(integrationInstances.updatedAt),
          )
          .all();
    return rows.map(toRecord);
  },

  getById(id: string) {
    const row = getDb()
      .select()
      .from(integrationInstances)
      .where(eq(integrationInstances.id, id))
      .get();
    return row ? toRecord(row) : null;
  },

  getDefault(provider: IntegrationProvider) {
    const row = getDb()
      .select()
      .from(integrationInstances)
      .where(
        and(
          eq(integrationInstances.provider, provider),
          eq(integrationInstances.isDefault, true),
        ),
      )
      .get();
    return row ? toRecord(row) : null;
  },

  create(input: IntegrationInstanceInput) {
    if (!input.provider) {
      throw new Error("provider is required");
    }

    clearDefaultIfNeeded(input.provider, Boolean(input.isDefault));

    const row = getDb()
      .insert(integrationInstances)
      .values({
        provider: input.provider,
        name: normalizeText(input.name ?? ""),
        externalTenantId:
          typeof input.externalTenantId === "string"
            ? normalizeText(input.externalTenantId) || null
            : null,
        configJsonEncrypted: encryptSecret(JSON.stringify(input.config ?? {})),
        enabled: input.enabled ?? true,
        isDefault: input.isDefault ?? false,
      })
      .returning()
      .get();

    return toRecord(row);
  },

  update(id: string, input: IntegrationInstanceInput) {
    const current = this.getById(id);
    if (!current) {
      return null;
    }

    const next = {
      name:
        typeof input.name === "string" ? normalizeText(input.name) : current.name,
      externalTenantId:
        typeof input.externalTenantId === "string"
          ? normalizeText(input.externalTenantId) || null
          : input.externalTenantId === null
            ? null
            : current.externalTenantId,
      config:
        typeof input.config === "object" && input.config
          ? input.config
          : current.config,
      enabled:
        typeof input.enabled === "boolean" ? input.enabled : current.enabled,
      isDefault:
        typeof input.isDefault === "boolean"
          ? input.isDefault
          : current.isDefault,
    };

    clearDefaultIfNeeded(current.provider, next.isDefault);

    const row = getDb()
      .update(integrationInstances)
      .set({
        name: next.name,
        externalTenantId: next.externalTenantId,
        configJsonEncrypted: encryptSecret(JSON.stringify(next.config)),
        enabled: next.enabled,
        isDefault: next.isDefault,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(integrationInstances.id, id))
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
      .delete(integrationInstances)
      .where(eq(integrationInstances.id, id))
      .run();

    return true;
  },
};
