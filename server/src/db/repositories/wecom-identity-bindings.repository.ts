import { and, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { externalIdentityBindings } from "../schema";

export type WecomIdentityBindingRecord = {
  userId: number;
  provider: "wecom";
  externalUserId: string;
  externalUnionId: string | null;
  bindSource: "manual" | "oauth";
  bindStatus: "bound";
};

const ensureBindingsTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS external_identity_bindings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      external_user_id TEXT NOT NULL,
      external_union_id TEXT,
      bind_source TEXT NOT NULL DEFAULT 'manual',
      bind_status TEXT NOT NULL DEFAULT 'bound',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_external_identity_bindings_provider_user
    ON external_identity_bindings(provider, user_id)
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_external_identity_bindings_provider_external_user
    ON external_identity_bindings(provider, external_user_id)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_external_identity_bindings_user_id
    ON external_identity_bindings(user_id)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_external_identity_bindings_provider
    ON external_identity_bindings(provider)
  `);
};

const ensureSingleRow = (userId: number) => {
  ensureBindingsTable();
  const db = getDb();
  const row = db
    .select()
    .from(externalIdentityBindings)
    .where(and(eq(externalIdentityBindings.provider, "wecom"), eq(externalIdentityBindings.userId, userId)))
    .limit(1)
    .get();

  return row ?? null;
};

export const wecomIdentityBindingsRepository = {
  initialize() {
    ensureBindingsTable();
  },

  getByUserId(userId: number): WecomIdentityBindingRecord | null {
    const row = ensureSingleRow(userId);
    if (!row) {
      return null;
    }

    return {
      userId: row.userId,
      provider: "wecom",
      externalUserId: row.externalUserId,
      externalUnionId: row.externalUnionId ?? null,
      bindSource: row.bindSource === "oauth" ? "oauth" : "manual",
      bindStatus: "bound",
    };
  },

  upsertByUserId(input: {
    userId: number;
    externalUserId: string;
    externalUnionId?: string | null;
    bindSource: "manual" | "oauth";
  }): WecomIdentityBindingRecord {
    ensureBindingsTable();
    const now = new Date().toISOString();
    const current = this.getByUserId(input.userId);
    const payload = {
      userId: input.userId,
      provider: "wecom" as const,
      externalUserId: input.externalUserId.trim(),
      externalUnionId: input.externalUnionId?.trim() || null,
      bindSource: input.bindSource,
      bindStatus: "bound" as const,
    };

    if (current) {
      getDb()
        .update(externalIdentityBindings)
        .set({
          externalUserId: payload.externalUserId,
          externalUnionId: payload.externalUnionId,
          bindSource: payload.bindSource,
          bindStatus: payload.bindStatus,
          updatedAt: now,
        })
        .where(
          and(
            eq(externalIdentityBindings.provider, "wecom"),
            eq(externalIdentityBindings.userId, input.userId),
          ),
        )
        .run();
    } else {
      getDb()
        .insert(externalIdentityBindings)
        .values({
          userId: payload.userId,
          provider: payload.provider,
          externalUserId: payload.externalUserId,
          externalUnionId: payload.externalUnionId,
          bindSource: payload.bindSource,
          bindStatus: payload.bindStatus,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    return payload;
  },

  deleteByUserId(userId: number) {
    ensureBindingsTable();
    return (
      getDb()
        .delete(externalIdentityBindings)
        .where(
          and(
            eq(externalIdentityBindings.provider, "wecom"),
            eq(externalIdentityBindings.userId, userId),
          ),
        )
        .run()
        .changes ?? 0
    );
  },
};
