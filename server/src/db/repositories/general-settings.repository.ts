import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { generalSettings } from "../schema";
import { decryptSecret, encryptSecret } from "@/utils/crypto.js";

export type GeneralSettingsRecord = {
  socks5Host: string;
  socks5Port: number;
  socks5Username: string;
  socks5Password: string;
};

const DEFAULT_PORT = 0;
const MIN_PORT = 1;
const MAX_PORT = 65535;

const normalizeText = (value: string) => value.trim();

const normalizePort = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_PORT;
  }

  const next = Math.trunc(value);
  if (next < MIN_PORT || next > MAX_PORT) {
    return DEFAULT_PORT;
  }

  return next;
};

const ensureSettingsTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS general_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      socks5_host TEXT NOT NULL DEFAULT '',
      socks5_port INTEGER NOT NULL DEFAULT 0,
      socks5_username TEXT NOT NULL DEFAULT '',
      socks5_password_encrypted TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

const ensureSingleRow = () => {
  ensureSettingsTable();
  const db = getDb();
  const row = db.select().from(generalSettings).limit(1).get();

  if (row) {
    return row;
  }

  return db.insert(generalSettings).values({}).returning().get();
};

export const generalSettingsRepository = {
  initialize() {
    ensureSingleRow();
  },

  get(): GeneralSettingsRecord {
    const row = ensureSingleRow();
    return {
      socks5Host: normalizeText(row?.socks5Host ?? ""),
      socks5Port: normalizePort(row?.socks5Port),
      socks5Username: normalizeText(row?.socks5Username ?? ""),
      socks5Password: decryptSecret(row?.socks5PasswordEncrypted ?? null),
    };
  },

  update(input: Partial<GeneralSettingsRecord>): GeneralSettingsRecord {
    const current = this.get();
    const next = {
      socks5Host:
        typeof input.socks5Host === "string"
          ? normalizeText(input.socks5Host)
          : current.socks5Host,
      socks5Port:
        typeof input.socks5Port === "number"
          ? normalizePort(input.socks5Port)
          : current.socks5Port,
      socks5Username:
        typeof input.socks5Username === "string"
          ? normalizeText(input.socks5Username)
          : current.socks5Username,
      socks5Password:
        typeof input.socks5Password === "string"
          ? input.socks5Password
          : current.socks5Password,
    };

    const row = ensureSingleRow();
    if (!row) {
      throw new Error("Failed to initialize general settings");
    }

    getDb()
      .update(generalSettings)
      .set({
        socks5Host: next.socks5Host,
        socks5Port: next.socks5Port,
        socks5Username: next.socks5Username,
        socks5PasswordEncrypted: next.socks5Password.trim()
          ? encryptSecret(next.socks5Password.trim())
          : null,
      })
      .where(eq(generalSettings.id, row.id))
      .run();

    return this.get();
  },
};
