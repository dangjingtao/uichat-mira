import { asc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { ttsProviderConfigs } from "../schema";

export type TtsProviderId = "windows_builtin" | "piper_local";

export type TtsProviderConfigRecord = {
  id: string;
  providerId: TtsProviderId;
  displayName: string;
  enabled: boolean;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type TtsProviderConfigInput = {
  enabled?: boolean;
  displayName?: string;
  config?: Record<string, unknown>;
};

const defaultSeeds: Array<{
  providerId: TtsProviderId;
  displayName: string;
  enabled: boolean;
  config: Record<string, unknown>;
}> = [
  {
    providerId: "windows_builtin",
    displayName: "Windows Built-in Voice",
    enabled: true,
    config: {
      defaultVoice: "",
      rate: 0,
      volume: 100,
    },
  },
  {
    providerId: "piper_local",
    displayName: "Piper Local",
    enabled: false,
    config: {
      executablePath: "",
      modelPath: "",
      voiceLabel: "",
      speaker: "",
    },
  },
];

const parseJson = (value: string, fallback: Record<string, unknown>) => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return fallback;
  }
};

const normalizeText = (value: string) => value.trim();

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tts_provider_configs (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      provider_id TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tts_provider_configs_provider_id
    ON tts_provider_configs(provider_id)
  `);
};

const toRecord = (
  row: typeof ttsProviderConfigs.$inferSelect,
): TtsProviderConfigRecord => ({
  id: row.id,
  providerId: row.providerId as TtsProviderId,
  displayName: normalizeText(row.displayName),
  enabled: Boolean(row.enabled),
  config: parseJson(row.configJson ?? "{}", {}),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const seedDefaults = () => {
  const existing = new Set(
    getDb()
      .select({ providerId: ttsProviderConfigs.providerId })
      .from(ttsProviderConfigs)
      .all()
      .map((item) => item.providerId),
  );

  for (const seed of defaultSeeds) {
    if (existing.has(seed.providerId)) {
      continue;
    }

    getDb()
      .insert(ttsProviderConfigs)
      .values({
        providerId: seed.providerId,
        displayName: seed.displayName,
        enabled: seed.enabled,
        configJson: JSON.stringify(seed.config),
      })
      .run();
  }
};

export const ttsProviderConfigsRepository = {
  initialize() {
    ensureTable();
    seedDefaults();
  },

  list() {
    return getDb()
      .select()
      .from(ttsProviderConfigs)
      .orderBy(asc(ttsProviderConfigs.providerId))
      .all()
      .map(toRecord);
  },

  getByProviderId(providerId: TtsProviderId) {
    const row = getDb()
      .select()
      .from(ttsProviderConfigs)
      .where(eq(ttsProviderConfigs.providerId, providerId))
      .get();
    return row ? toRecord(row) : null;
  },

  upsert(providerId: TtsProviderId, input: TtsProviderConfigInput) {
    const current = this.getByProviderId(providerId);
    if (!current) {
      const row = getDb()
        .insert(ttsProviderConfigs)
        .values({
          providerId,
          displayName: normalizeText(input.displayName ?? providerId),
          enabled: input.enabled ?? true,
          configJson: JSON.stringify(input.config ?? {}),
        })
        .returning()
        .get();
      return toRecord(row);
    }

    const row = getDb()
      .update(ttsProviderConfigs)
      .set({
        displayName:
          typeof input.displayName === "string"
            ? normalizeText(input.displayName)
            : current.displayName,
        enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
        configJson: JSON.stringify(input.config ?? current.config),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(ttsProviderConfigs.id, current.id))
      .returning()
      .get();
    return toRecord(row);
  },
};
