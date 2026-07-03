import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { integrationCapabilityMicroApps } from "../schema";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";

export type IntegrationCapabilityMicroAppBindingRecord = {
  id: string;
  capabilityId: string;
  microAppDefinitionId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type BindingInput = {
  microAppDefinitionId: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
};

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
    CREATE TABLE IF NOT EXISTS integration_capability_micro_app_bindings (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      capability_id TEXT NOT NULL,
      micro_app_definition_id TEXT NOT NULL,
      binding_config_json_encrypted TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(capability_id) REFERENCES integration_capabilities(id) ON DELETE CASCADE,
      FOREIGN KEY(micro_app_definition_id) REFERENCES micro_app_definitions(id) ON DELETE CASCADE
    )
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_capability_micro_apps_capability
    ON integration_capability_micro_app_bindings(capability_id)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_integration_capability_micro_apps_micro_app
    ON integration_capability_micro_app_bindings(micro_app_definition_id)
  `);
};

const toRecord = (
  row: typeof integrationCapabilityMicroApps.$inferSelect,
): IntegrationCapabilityMicroAppBindingRecord => ({
  id: row.id,
  capabilityId: row.capabilityId,
  microAppDefinitionId: row.microAppDefinitionId,
  enabled: Boolean(row.enabled),
  config: parseJson(
    decryptSecret(row.bindingConfigJsonEncrypted ?? null) || "{}",
    {},
  ),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const integrationCapabilityMicroAppsRepository = {
  initialize() {
    ensureTable();
  },

  getByCapabilityId(capabilityId: string) {
    const row = getDb()
      .select()
      .from(integrationCapabilityMicroApps)
      .where(eq(integrationCapabilityMicroApps.capabilityId, capabilityId))
      .get();
    return row ? toRecord(row) : null;
  },

  listByMicroAppId(microAppDefinitionId: string) {
    return getDb()
      .select()
      .from(integrationCapabilityMicroApps)
      .where(
        eq(
          integrationCapabilityMicroApps.microAppDefinitionId,
          microAppDefinitionId,
        ),
      )
      .all()
      .map(toRecord);
  },

  bind(capabilityId: string, input: BindingInput) {
    const existing = this.getByCapabilityId(capabilityId);
    if (existing) {
      const row = getDb()
        .update(integrationCapabilityMicroApps)
        .set({
          microAppDefinitionId: input.microAppDefinitionId,
          bindingConfigJsonEncrypted: encryptSecret(
            JSON.stringify(input.config ?? existing.config),
          ),
          enabled:
            typeof input.enabled === "boolean" ? input.enabled : existing.enabled,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(integrationCapabilityMicroApps.id, existing.id))
        .returning()
        .get();
      return toRecord(row);
    }

    const row = getDb()
      .insert(integrationCapabilityMicroApps)
      .values({
        capabilityId,
        microAppDefinitionId: input.microAppDefinitionId,
        bindingConfigJsonEncrypted: encryptSecret(
          JSON.stringify(input.config ?? {}),
        ),
        enabled: input.enabled ?? true,
      })
      .returning()
      .get();
    return toRecord(row);
  },

  updateConfig(capabilityId: string, config: Record<string, unknown>) {
    const existing = this.getByCapabilityId(capabilityId);
    if (!existing) {
      return null;
    }

    const row = getDb()
      .update(integrationCapabilityMicroApps)
      .set({
        bindingConfigJsonEncrypted: encryptSecret(JSON.stringify(config)),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(integrationCapabilityMicroApps.id, existing.id))
      .returning()
      .get();

    return toRecord(row);
  },

  unbindByCapabilityId(capabilityId: string) {
    const existing = this.getByCapabilityId(capabilityId);
    if (!existing) {
      return false;
    }

    getDb()
      .delete(integrationCapabilityMicroApps)
      .where(eq(integrationCapabilityMicroApps.id, existing.id))
      .run();
    return true;
  },
};
