import { randomUUID } from "node:crypto";
import { getSqlite } from "../index.js";

export type NotionAccessPointType = "page_scope" | "database" | "publish_target";
export type NotionAccessPointStatus = "pending" | "verified" | "error" | "disabled";

export type NotionAccessPointRecord = {
  id: string;
  name: string;
  type: NotionAccessPointType;
  resourceId: string;
  resourceUrl: string | null;
  resourceTitle: string;
  enabled: boolean;
  includeChildren: boolean;
  allowedActions: string[];
  verificationStatus: NotionAccessPointStatus;
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
};

const parseActions = (value: unknown) => {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const ensureTable = () => {
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS notion_access_points (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      resource_url TEXT,
      resource_title TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      include_children INTEGER NOT NULL DEFAULT 0,
      allowed_actions_json TEXT NOT NULL DEFAULT '[]',
      verification_status TEXT NOT NULL DEFAULT 'pending',
      last_verified_at TEXT,
      last_error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

const mapRow = (row: Record<string, unknown>): NotionAccessPointRecord => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  type: String(row.type) as NotionAccessPointType,
  resourceId: String(row.resource_id),
  resourceUrl: typeof row.resource_url === "string" ? row.resource_url : null,
  resourceTitle: String(row.resource_title ?? ""),
  enabled: Boolean(row.enabled),
  includeChildren: Boolean(row.include_children),
  allowedActions: parseActions(row.allowed_actions_json),
  verificationStatus: String(row.verification_status) as NotionAccessPointStatus,
  lastVerifiedAt: typeof row.last_verified_at === "string" ? row.last_verified_at : null,
  lastErrorMessage: typeof row.last_error_message === "string" ? row.last_error_message : null,
});

export const notionAccessPointsRepository = {
  initialize() { ensureTable(); },
  list() { ensureTable(); return (getSqlite().prepare("SELECT * FROM notion_access_points ORDER BY created_at ASC").all() as Record<string, unknown>[]).map(mapRow); },
  getById(id: string) { ensureTable(); const row = getSqlite().prepare("SELECT * FROM notion_access_points WHERE id = ?").get(id) as Record<string, unknown> | undefined; return row ? mapRow(row) : null; },
  create(input: Omit<NotionAccessPointRecord, "id" | "lastVerifiedAt" | "lastErrorMessage">) {
    ensureTable();
    const id = randomUUID();
    getSqlite().prepare(`INSERT INTO notion_access_points (id,name,type,resource_id,resource_url,resource_title,enabled,include_children,allowed_actions_json,verification_status) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(id, input.name.trim(), input.type, input.resourceId, input.resourceUrl, input.resourceTitle, input.enabled ? 1 : 0, input.includeChildren ? 1 : 0, JSON.stringify(input.allowedActions), input.verificationStatus);
    return this.getById(id)!;
  },
  updateStatus(id: string, input: { resourceTitle?: string; verificationStatus: NotionAccessPointStatus; lastErrorMessage?: string | null }) {
    ensureTable();
    getSqlite().prepare("UPDATE notion_access_points SET resource_title = COALESCE(?, resource_title), verification_status = ?, last_verified_at = ?, last_error_message = ?, updated_at = datetime('now') WHERE id = ?").run(input.resourceTitle ?? null, input.verificationStatus, input.verificationStatus === "verified" ? new Date().toISOString() : null, input.lastErrorMessage ?? null, id);
    return this.getById(id);
  },
  delete(id: string) { ensureTable(); return getSqlite().prepare("DELETE FROM notion_access_points WHERE id = ?").run(id).changes > 0; },
};
