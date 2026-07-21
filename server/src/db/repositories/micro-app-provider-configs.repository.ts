import { decryptSecret, encryptSecret } from "@/utils/crypto.js";
import { getSqlite } from "../index.js";

export type MicroAppProviderApp = "image_generation" | "tts";
export type MicroAppProviderKind = "volcengine" | "openai-compatible";
export type MicroAppProviderConfig = {
  app: MicroAppProviderApp;
  kind: MicroAppProviderKind;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  updatedAt: string;
};

const ensureTable = () => getSqlite().exec(`
  CREATE TABLE IF NOT EXISTS micro_app_provider_configs (
    app TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('volcengine', 'openai-compatible')),
    base_url TEXT NOT NULL DEFAULT '',
    api_key_encrypted TEXT,
    model_id TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

export const microAppProviderConfigsRepository = {
  initialize() { ensureTable(); },
  get(app: MicroAppProviderApp): MicroAppProviderConfig | null {
    ensureTable();
    const row = getSqlite().prepare("SELECT * FROM micro_app_provider_configs WHERE app = ?").get(app) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      app,
      kind: row.kind === "volcengine" ? "volcengine" : "openai-compatible",
      baseUrl: String(row.base_url ?? ""),
      apiKey: decryptSecret(typeof row.api_key_encrypted === "string" ? row.api_key_encrypted : null),
      modelId: String(row.model_id ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    };
  },
  upsert(app: MicroAppProviderApp, input: Omit<MicroAppProviderConfig, "app" | "updatedAt">) {
    ensureTable();
    if (!input.baseUrl.trim() || !input.modelId.trim()) throw new Error("Provider base URL and model ID are required.");
    getSqlite().prepare(`
      INSERT INTO micro_app_provider_configs (app, kind, base_url, api_key_encrypted, model_id, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(app) DO UPDATE SET kind=excluded.kind, base_url=excluded.base_url,
        api_key_encrypted=excluded.api_key_encrypted, model_id=excluded.model_id, updated_at=datetime('now')
    `).run(app, input.kind, input.baseUrl.trim(), encryptSecret(input.apiKey.trim()), input.modelId.trim());
    return this.get(app);
  },
};
