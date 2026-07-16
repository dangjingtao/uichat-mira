import { and, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { microAppCapabilityBindings } from "../schema";

export type MicroAppCapabilityCode = "imageGeneration" | "tts";
export type MicroAppProviderId =
  | "api_provider"
  | "comfyui_local"
  | "piper_local"
  | "gpt_sovits";

const ensureTable = () => {
  const sqlite = getSqlite();
  const columns = sqlite
    .prepare("PRAGMA table_info(micro_app_capability_bindings)")
    .all() as Array<{ name: string }>;
  if (columns.length > 0 && !columns.some((column) => column.name === "provider_id")) {
    // Previous builds stored model-setting connection IDs here. They cannot be
    // translated to the micro-app provider tabs, so discard only those stale bindings.
    sqlite.exec("DROP TABLE micro_app_capability_bindings");
  }
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS micro_app_capability_bindings (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      micro_app_code TEXT NOT NULL,
      capability_code TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(micro_app_code, capability_code)
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_micro_app_capability_bindings_provider
    ON micro_app_capability_bindings(provider_id)
  `);
};

export const microAppCapabilityBindingsRepository = {
  initialize() {
    ensureTable();
  },

  get(microAppCode: string, capabilityCode: MicroAppCapabilityCode) {
    ensureTable();
    return getDb()
      .select()
      .from(microAppCapabilityBindings)
      .where(
        and(
          eq(microAppCapabilityBindings.microAppCode, microAppCode),
          eq(microAppCapabilityBindings.capabilityCode, capabilityCode),
        ),
      )
      .get();
  },

  list() {
    ensureTable();
    return getDb().select().from(microAppCapabilityBindings).all();
  },

  upsert(input: {
    microAppCode: string;
    capabilityCode: MicroAppCapabilityCode;
    providerId: MicroAppProviderId;
  }) {
    ensureTable();
    const current = this.get(input.microAppCode, input.capabilityCode);
    if (current) {
      return getDb()
        .update(microAppCapabilityBindings)
        .set({
          providerId: input.providerId,
          enabled: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(microAppCapabilityBindings.id, current.id))
        .returning()
        .get();
    }

    return getDb()
      .insert(microAppCapabilityBindings)
      .values({
        microAppCode: input.microAppCode,
        capabilityCode: input.capabilityCode,
        providerId: input.providerId,
      })
      .returning()
      .get();
  },
};
