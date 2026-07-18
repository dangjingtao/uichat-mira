import { randomUUID } from "node:crypto";
import { getSqlite } from "../index.js";

export type NotionActivityStatus = "completed" | "failed" | "blocked";

export type NotionActivityRecord = {
  id: string;
  action: string;
  accessPointId: string | null;
  resourceId: string | null;
  status: NotionActivityStatus;
  summary: string;
  occurredAt: string;
  traceId: string | null;
};

const ensureTable = () => {
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS notion_activities (
      id TEXT PRIMARY KEY NOT NULL,
      action TEXT NOT NULL,
      access_point_id TEXT,
      resource_id TEXT,
      status TEXT NOT NULL,
      summary TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      trace_id TEXT
    )
  `);
  getSqlite().exec("CREATE INDEX IF NOT EXISTS idx_notion_activities_occurred_at ON notion_activities(occurred_at DESC)");
};

const mapRow = (row: Record<string, unknown>): NotionActivityRecord => ({
  id: String(row.id),
  action: String(row.action),
  accessPointId: typeof row.access_point_id === "string" ? row.access_point_id : null,
  resourceId: typeof row.resource_id === "string" ? row.resource_id : null,
  status: String(row.status) as NotionActivityStatus,
  summary: String(row.summary),
  occurredAt: String(row.occurred_at),
  traceId: typeof row.trace_id === "string" ? row.trace_id : null,
});

export const notionActivitiesRepository = {
  initialize() { ensureTable(); },
  list(limit = 50) {
    ensureTable();
    return (getSqlite().prepare("SELECT * FROM notion_activities ORDER BY occurred_at DESC LIMIT ?").all(Math.min(Math.max(limit, 1), 200)) as Record<string, unknown>[]).map(mapRow);
  },
  create(input: Omit<NotionActivityRecord, "id" | "occurredAt"> & { occurredAt?: string }) {
    ensureTable();
    const record = { id: randomUUID(), occurredAt: input.occurredAt ?? new Date().toISOString(), ...input };
    getSqlite().prepare("INSERT INTO notion_activities (id,action,access_point_id,resource_id,status,summary,occurred_at,trace_id) VALUES (?,?,?,?,?,?,?,?)").run(record.id, record.action, record.accessPointId, record.resourceId, record.status, record.summary, record.occurredAt, record.traceId);
    return record;
  },
};
