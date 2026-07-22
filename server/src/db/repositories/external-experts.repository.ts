import crypto from "node:crypto";
import { getSqlite } from "../index";

export type ExternalExpertProvider = "chatgpt" | "kimi" | "deepseek";
export type ExternalExpertStatus = "unbound" | "ready" | "expired" | "error";

export type ExternalExpert = {
  id: string;
  userId: number;
  name: string;
  provider: ExternalExpertProvider;
  externalSessionRef: { kind: "conversation_id" | "url" | "provider_state"; value: string } | null;
  accountLabel: string | null;
  status: ExternalExpertStatus;
  createdAt: string;
  updatedAt: string;
};

type ExternalExpertRow = {
  id: string;
  name: string;
  provider: ExternalExpertProvider;
  account_label: string | null;
  status: ExternalExpertStatus;
  external_session_ref_json: string | null;
  user_id: number;
  created_at: string;
  updated_at: string;
};

const ensureTable = () => {
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS external_experts (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      external_session_ref_json TEXT,
      account_label TEXT,
      status TEXT NOT NULL DEFAULT 'unbound',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_external_experts_user_id
      ON external_experts(user_id, updated_at DESC);
  `);
};

const parseSessionRef = (value: string | null) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const ref = parsed as Record<string, unknown>;
    if (!["conversation_id", "url", "provider_state"].includes(String(ref.kind))) return null;
    return { kind: ref.kind as "conversation_id" | "url" | "provider_state", value: String(ref.value || "") };
  } catch {
    return null;
  }
};

const mapRow = (row: ExternalExpertRow): ExternalExpert => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  provider: row.provider,
  externalSessionRef: parseSessionRef(row.external_session_ref_json),
  accountLabel: row.account_label,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const externalExpertsRepository = {
  initialize() {
    ensureTable();
  },

  listByUser(userId: number) {
    ensureTable();
    return (getSqlite().prepare("SELECT * FROM external_experts WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as ExternalExpertRow[]).map(mapRow);
  },

  getById(id: string, userId: number) {
    ensureTable();
    const row = getSqlite().prepare("SELECT * FROM external_experts WHERE id = ? AND user_id = ?").get(id, userId) as ExternalExpertRow | undefined;
    return row ? mapRow(row) : null;
  },

  create(input: { userId: number; name: string; provider: ExternalExpertProvider }) {
    ensureTable();
    const id = crypto.randomUUID();
    getSqlite().prepare("INSERT INTO external_experts (id, user_id, name, provider) VALUES (?, ?, ?, ?)").run(id, input.userId, input.name, input.provider);
    return this.getById(id, input.userId)!;
  },

  updateBinding(input: {
    id: string;
    userId: number;
    externalSessionRef: { kind: "conversation_id" | "url" | "provider_state"; value: string };
    accountLabel?: string;
    status: ExternalExpertStatus;
  }) {
    ensureTable();
    getSqlite().prepare(`
      UPDATE external_experts
      SET external_session_ref_json = ?, account_label = ?, status = ?, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(JSON.stringify(input.externalSessionRef), input.accountLabel || null, input.status, input.id, input.userId);
    return this.getById(input.id, input.userId);
  },

  updateStatus(id: string, userId: number, status: ExternalExpertStatus) {
    ensureTable();
    getSqlite().prepare("UPDATE external_experts SET status = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?").run(status, id, userId);
    return this.getById(id, userId);
  },
};
