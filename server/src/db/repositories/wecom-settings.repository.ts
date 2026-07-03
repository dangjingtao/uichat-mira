import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { wecomSettings } from "../schema";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";

export type WecomSettingsRecord = {
  corpId: string;
  agentId: string;
  appSecret: string;
  contactsSecret: string;
  robotWebhookUrl: string;
  robotWebhookSecret: string;
  smartRobotBotId: string;
  smartRobotSecret: string;
  smartRobotKnowledgeBaseId: string;
  smartRobotReplyMode: "stream" | "send";
};

const normalizeText = (value: string) => value.trim();

const ensureSettingsTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS wecom_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      corp_id TEXT NOT NULL DEFAULT '',
      agent_id TEXT NOT NULL DEFAULT '',
      app_secret_encrypted TEXT,
      contacts_secret_encrypted TEXT,
      robot_webhook_url_encrypted TEXT,
      robot_webhook_secret_encrypted TEXT,
      smart_robot_bot_id_encrypted TEXT,
      smart_robot_secret_encrypted TEXT,
      smart_robot_knowledge_base_id_encrypted TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

const ensureSettingsColumns = () => {
  const sqlite = getSqlite();
  const columns = new Set(
    (sqlite.prepare(`PRAGMA table_info(wecom_settings)`).all() as Array<{ name: string }>)
      .map((column) => column.name),
  );

  if (!columns.has("app_secret_encrypted")) {
    sqlite.exec(
      "ALTER TABLE wecom_settings ADD COLUMN app_secret_encrypted TEXT",
    );
  }

  if (!columns.has("contacts_secret_encrypted")) {
    sqlite.exec(
      "ALTER TABLE wecom_settings ADD COLUMN contacts_secret_encrypted TEXT",
    );
  }

  if (!columns.has("robot_webhook_url_encrypted")) {
    sqlite.exec(
      "ALTER TABLE wecom_settings ADD COLUMN robot_webhook_url_encrypted TEXT",
    );
  }

  if (!columns.has("robot_webhook_secret_encrypted")) {
    sqlite.exec(
      "ALTER TABLE wecom_settings ADD COLUMN robot_webhook_secret_encrypted TEXT",
    );
  }

  if (!columns.has("smart_robot_bot_id_encrypted")) {
    sqlite.exec(
      "ALTER TABLE wecom_settings ADD COLUMN smart_robot_bot_id_encrypted TEXT",
    );
  }

  if (!columns.has("smart_robot_secret_encrypted")) {
    sqlite.exec(
      "ALTER TABLE wecom_settings ADD COLUMN smart_robot_secret_encrypted TEXT",
    );
  }

  if (!columns.has("smart_robot_knowledge_base_id_encrypted")) {
    sqlite.exec(
      "ALTER TABLE wecom_settings ADD COLUMN smart_robot_knowledge_base_id_encrypted TEXT",
    );
  }

  if (!columns.has("smart_robot_reply_mode")) {
    sqlite.exec(
      "ALTER TABLE wecom_settings ADD COLUMN smart_robot_reply_mode TEXT NOT NULL DEFAULT 'stream'",
    );
  }
};

const ensureSingleRow = () => {
  ensureSettingsTable();
  ensureSettingsColumns();
  const db = getDb();
  const row = db.select().from(wecomSettings).limit(1).get();

  if (row) {
    return row;
  }

  return db.insert(wecomSettings).values({}).returning().get();
};

export const wecomSettingsRepository = {
  initialize() {
    ensureSingleRow();
  },

  get(): WecomSettingsRecord {
    const row = ensureSingleRow();
    return {
      corpId: normalizeText(row?.corpId ?? ""),
      agentId: normalizeText(row?.agentId ?? ""),
      appSecret: decryptSecret(row?.appSecretEncrypted ?? null),
      contactsSecret: decryptSecret(row?.contactsSecretEncrypted ?? null),
      robotWebhookUrl: decryptSecret(row?.robotWebhookUrlEncrypted ?? null),
      robotWebhookSecret: decryptSecret(
        row?.robotWebhookSecretEncrypted ?? null,
      ),
      smartRobotBotId: decryptSecret(row?.smartRobotBotIdEncrypted ?? null),
      smartRobotSecret: decryptSecret(row?.smartRobotSecretEncrypted ?? null),
      smartRobotKnowledgeBaseId: decryptSecret(
        row?.smartRobotKnowledgeBaseIdEncrypted ?? null,
      ),
      smartRobotReplyMode:
        row?.smartRobotReplyMode === "send" ? "send" : "stream",
    };
  },

  update(input: Partial<WecomSettingsRecord>): WecomSettingsRecord {
    const current = this.get();
    const next = {
      corpId:
        typeof input.corpId === "string"
          ? normalizeText(input.corpId)
          : current.corpId,
      agentId:
        typeof input.agentId === "string"
          ? normalizeText(input.agentId)
          : current.agentId,
      appSecret:
        typeof input.appSecret === "string" ? input.appSecret.trim() : current.appSecret,
      contactsSecret:
        typeof input.contactsSecret === "string"
          ? input.contactsSecret.trim()
          : current.contactsSecret,
      robotWebhookUrl:
        typeof input.robotWebhookUrl === "string"
          ? input.robotWebhookUrl.trim()
          : current.robotWebhookUrl,
      robotWebhookSecret:
        typeof input.robotWebhookSecret === "string"
          ? input.robotWebhookSecret.trim()
          : current.robotWebhookSecret,
      smartRobotBotId:
        typeof input.smartRobotBotId === "string"
          ? input.smartRobotBotId.trim()
          : current.smartRobotBotId,
      smartRobotSecret:
        typeof input.smartRobotSecret === "string"
          ? input.smartRobotSecret.trim()
          : current.smartRobotSecret,
      smartRobotKnowledgeBaseId:
        typeof input.smartRobotKnowledgeBaseId === "string"
          ? input.smartRobotKnowledgeBaseId.trim()
          : current.smartRobotKnowledgeBaseId,
      smartRobotReplyMode:
        input.smartRobotReplyMode === "send" || input.smartRobotReplyMode === "stream"
          ? input.smartRobotReplyMode
          : current.smartRobotReplyMode,
    };

    const row = ensureSingleRow();
    if (!row) {
      throw new Error("Failed to initialize WeCom settings");
    }

    getDb()
      .update(wecomSettings)
      .set({
        corpId: next.corpId,
        agentId: next.agentId,
        appSecretEncrypted: next.appSecret ? encryptSecret(next.appSecret) : null,
        contactsSecretEncrypted: next.contactsSecret
          ? encryptSecret(next.contactsSecret)
          : null,
        robotWebhookUrlEncrypted: next.robotWebhookUrl
          ? encryptSecret(next.robotWebhookUrl)
          : null,
        robotWebhookSecretEncrypted: next.robotWebhookSecret
          ? encryptSecret(next.robotWebhookSecret)
          : null,
        smartRobotBotIdEncrypted: next.smartRobotBotId
          ? encryptSecret(next.smartRobotBotId)
          : null,
        smartRobotSecretEncrypted: next.smartRobotSecret
          ? encryptSecret(next.smartRobotSecret)
          : null,
        smartRobotKnowledgeBaseIdEncrypted: next.smartRobotKnowledgeBaseId
          ? encryptSecret(next.smartRobotKnowledgeBaseId)
          : null,
        smartRobotReplyMode: next.smartRobotReplyMode,
      })
      .where(eq(wecomSettings.id, row.id))
      .run();

    return next;
  },
};
