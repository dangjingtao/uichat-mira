import { desc, eq } from "drizzle-orm";
import { nowIso } from "@/utils/time.js";
import { getDb, getSqlite } from "../index";
import {
  comfyUiConnections,
  comfyUiFlows,
  type ComfyUiConnectionRow,
  type ComfyUiFlowRow,
  type NewComfyUiConnectionRow,
  type NewComfyUiFlowRow,
} from "../schema";

export type ComfyUiConnectionStatus =
  | "unconfigured"
  | "unverified"
  | "connectable"
  | "failed";

export type ComfyUiFlowSource = "template" | "upload" | "manual";

export type ComfyUiFlowMapping = {
  promptPath: string;
  seedPath: string;
  widthPath: string;
  heightPath: string;
  outputNodeId: string;
  previewNodeId: string;
};

export type ComfyUiConnectionRecord = {
  id: string;
  baseUrl: string;
  clientId: string;
  status: ComfyUiConnectionStatus;
  lastError: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComfyUiFlowRecord = {
  id: string;
  connectionId: string | null;
  name: string;
  note: string;
  source: ComfyUiFlowSource;
  workflowApiJson: string;
  mapping: ComfyUiFlowMapping;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_FLOWS: Array<
  Omit<ComfyUiFlowRecord, "id" | "connectionId" | "createdAt" | "updatedAt">
> = [
  {
    name: "SDXL Text to Image",
    note: "标准文本生图 workflow，适合先验证 prompt 和 seed 覆盖链路。",
    source: "template",
    workflowApiJson:
      '{\n  "6": { "class_type": "CLIPTextEncode", "inputs": { "text": "" }, "_meta": { "title": "正向提示词" } },\n  "13": { "class_type": "EmptyLatentImage", "inputs": { "width": 1024, "height": 1024, "batch_size": 1 }, "_meta": { "title": "空 Latent" } },\n  "3": { "class_type": "KSampler", "inputs": { "seed": 0 }, "_meta": { "title": "采样器" } },\n  "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "sdxl-debug", "images": ["8", 0] }, "_meta": { "title": "保存图像" } }\n}',
    mapping: {
      promptPath: "6.text",
      seedPath: "3.seed",
      widthPath: "13.width",
      heightPath: "13.height",
      outputNodeId: "9",
      previewNodeId: "9",
    },
  },
  {
    name: "Reference Image Remix",
    note: "参考图重绘 workflow，用来验证图生图的基础入口形态。",
    source: "upload",
    workflowApiJson:
      '{\n  "10": { "class_type": "LoadImage", "inputs": {}, "_meta": { "title": "参考图输入" } },\n  "6": { "class_type": "CLIPTextEncode", "inputs": { "text": "" }, "_meta": { "title": "正向提示词" } },\n  "13": { "class_type": "EmptyLatentImage", "inputs": { "width": 1024, "height": 1024, "batch_size": 1 }, "_meta": { "title": "空 Latent" } },\n  "3": { "class_type": "KSampler", "inputs": { "seed": 0, "denoise": 0.5 }, "_meta": { "title": "采样器" } },\n  "9": { "class_type": "PreviewImage", "inputs": { "images": ["8", 0] }, "_meta": { "title": "预览图像" } }\n}',
    mapping: {
      promptPath: "6.text",
      seedPath: "3.seed",
      widthPath: "13.width",
      heightPath: "13.height",
      outputNodeId: "9",
      previewNodeId: "9",
    },
  },
];

const emptyMapping = (): ComfyUiFlowMapping => ({
  promptPath: "",
  seedPath: "",
  widthPath: "",
  heightPath: "",
  outputNodeId: "",
  previewNodeId: "",
});

const parseJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toConnectionRecord = (row: ComfyUiConnectionRow): ComfyUiConnectionRecord => ({
  id: row.id,
  baseUrl: row.baseUrl,
  clientId: row.clientId ?? "",
  status: row.status,
  lastError: parseJson(row.lastErrorJson, null),
  lastCheckedAt: row.lastCheckedAt ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toFlowRecord = (row: ComfyUiFlowRow): ComfyUiFlowRecord => ({
  id: row.id,
  connectionId: row.connectionId ?? null,
  name: row.name,
  note: row.note,
  source: row.source,
  workflowApiJson: row.workflowApiJson,
  mapping: parseJson(row.mappingJson, emptyMapping()),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ensureTables = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS comfyui_connections (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      base_url TEXT NOT NULL DEFAULT '',
      client_id TEXT,
      status TEXT NOT NULL DEFAULT 'unconfigured',
      last_error_json TEXT,
      last_checked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_comfyui_connections_status
    ON comfyui_connections(status)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_comfyui_connections_updated_at
    ON comfyui_connections(updated_at)
  `);
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS comfyui_flows (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      connection_id TEXT REFERENCES comfyui_connections(id) ON DELETE SET NULL,
      name TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      workflow_api_json TEXT NOT NULL DEFAULT '{}',
      mapping_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_comfyui_flows_connection_id
    ON comfyui_flows(connection_id)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_comfyui_flows_updated_at
    ON comfyui_flows(updated_at)
  `);
};

const seedDefaultFlows = () => {
  const db = getDb();
  const existing = db.select().from(comfyUiFlows).limit(1).get();
  if (existing) {
    return;
  }

  db.insert(comfyUiFlows)
    .values(
      DEFAULT_FLOWS.map((flow) => ({
        connectionId: null,
        name: flow.name,
        note: flow.note,
        source: flow.source,
        workflowApiJson: flow.workflowApiJson,
        mappingJson: JSON.stringify(flow.mapping),
      })),
    )
    .run();
};

export const comfyUiStudioRepository = {
  initialize() {
    ensureTables();
    seedDefaultFlows();
  },

  listConnections(): ComfyUiConnectionRecord[] {
    return getDb()
      .select()
      .from(comfyUiConnections)
      .orderBy(desc(comfyUiConnections.updatedAt), desc(comfyUiConnections.createdAt))
      .all()
      .map(toConnectionRecord);
  },

  getConnectionById(id: string): ComfyUiConnectionRecord | null {
    const row = getDb()
      .select()
      .from(comfyUiConnections)
      .where(eq(comfyUiConnections.id, id))
      .get();
    return row ? toConnectionRecord(row) : null;
  },

  createConnection(
    input: Omit<NewComfyUiConnectionRow, "id" | "createdAt" | "updatedAt">,
  ): ComfyUiConnectionRecord {
    const row = getDb()
      .insert(comfyUiConnections)
      .values(input)
      .returning()
      .get();
    return toConnectionRecord(row);
  },

  updateConnection(
    id: string,
    input: Partial<Omit<NewComfyUiConnectionRow, "id" | "createdAt" | "updatedAt">>,
  ): ComfyUiConnectionRecord | null {
    const row = getDb()
      .update(comfyUiConnections)
      .set({
        ...input,
        updatedAt: nowIso(),
      })
      .where(eq(comfyUiConnections.id, id))
      .returning()
      .get();
    return row ? toConnectionRecord(row) : null;
  },

  listFlows(): ComfyUiFlowRecord[] {
    return getDb()
      .select()
      .from(comfyUiFlows)
      .orderBy(desc(comfyUiFlows.updatedAt), desc(comfyUiFlows.createdAt))
      .all()
      .map(toFlowRecord);
  },

  getFlowById(id: string): ComfyUiFlowRecord | null {
    const row = getDb()
      .select()
      .from(comfyUiFlows)
      .where(eq(comfyUiFlows.id, id))
      .get();
    return row ? toFlowRecord(row) : null;
  },

  createFlow(
    input: Omit<NewComfyUiFlowRow, "id" | "createdAt" | "updatedAt">,
  ): ComfyUiFlowRecord {
    const row = getDb()
      .insert(comfyUiFlows)
      .values(input)
      .returning()
      .get();
    return toFlowRecord(row);
  },

  updateFlow(
    id: string,
    input: Partial<Omit<NewComfyUiFlowRow, "id" | "createdAt" | "updatedAt">>,
  ): ComfyUiFlowRecord | null {
    const row = getDb()
      .update(comfyUiFlows)
      .set({
        ...input,
        updatedAt: nowIso(),
      })
      .where(eq(comfyUiFlows.id, id))
      .returning()
      .get();
    return row ? toFlowRecord(row) : null;
  },
};
