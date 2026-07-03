import { asc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { microApps } from "../schema";

export type MicroAppType = "knowledge_query";

export type MicroAppSupportedAccessPoint = "wecom.smart_robot";

export type MicroAppBindingFieldType =
  | "knowledge_base_select"
  | "text"
  | "textarea"
  | "number"
  | "switch"
  | "select";

export type MicroAppBindingFieldOption = {
  label: string;
  value: string;
};

export type MicroAppBindingFieldSchema = {
  key: string;
  label: string;
  type: MicroAppBindingFieldType;
  required: boolean;
  description?: string;
  placeholder?: string;
  defaultValue?: string | number | boolean | null;
  options?: MicroAppBindingFieldOption[];
};

export type MicroAppBindingSchema = {
  fields: MicroAppBindingFieldSchema[];
};

export type MicroAppRecord = {
  id: string;
  type: MicroAppType;
  name: string;
  description: string;
  supportedAccessPoints: MicroAppSupportedAccessPoint[];
  bindingSchema: MicroAppBindingSchema;
  runtimeKey: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type MicroAppInput = Partial<Omit<MicroAppRecord, "id" | "createdAt" | "updatedAt">>;

const normalizeText = (value: string) => value.trim();

const parseJson = <T>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const defaultKnowledgeQuerySchema: MicroAppBindingSchema = {
  fields: [
    {
      key: "knowledgeBaseId",
      label: "知识库",
      type: "knowledge_base_select",
      required: true,
      description: "这个接入点收到问题后，将使用这里指定的知识库执行检索问答。",
      defaultValue: "",
    },
  ],
};

const defaultDefinitionSeed: Omit<MicroAppRecord, "id" | "createdAt" | "updatedAt"> = {
  type: "knowledge_query",
  name: "Knowledge Query",
  description: "接收外部问答入口的文本问题，调用本地知识库检索链路，并返回一条稳定文本回复。",
  supportedAccessPoints: ["wecom.smart_robot"],
  bindingSchema: defaultKnowledgeQuerySchema,
  runtimeKey: "knowledge-query",
  enabled: true,
};

const ensureTable = () => {
  const sqlite = getSqlite();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS micro_app_definitions (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (lower(hex(randomblob(16)))),
      type TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      supported_access_points_json TEXT NOT NULL DEFAULT '[]',
      binding_schema_json TEXT NOT NULL DEFAULT '{"fields":[]}',
      runtime_key TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_micro_apps_type
    ON micro_app_definitions(type)
  `);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_micro_apps_enabled
    ON micro_app_definitions(enabled)
  `);
  sqlite.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_micro_apps_type_unique
    ON micro_app_definitions(type)
  `);
};

const seedDefaults = () => {
  const existing = getDb().select().from(microApps).all();
  if (existing.length > 0) {
    return;
  }

  getDb()
    .insert(microApps)
    .values({
      type: defaultDefinitionSeed.type,
      name: defaultDefinitionSeed.name,
      description: defaultDefinitionSeed.description,
      supportedAccessPointsJson: JSON.stringify(
        defaultDefinitionSeed.supportedAccessPoints,
      ),
      bindingSchemaJson: JSON.stringify(defaultDefinitionSeed.bindingSchema),
      runtimeKey: defaultDefinitionSeed.runtimeKey,
      enabled: defaultDefinitionSeed.enabled,
    })
    .run();
};

const migrateFromLegacyMicroAppsTable = () => {
  const sqlite = getSqlite();
  const hasLegacyTable = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='micro_apps'",
    )
    .get();
  if (!hasLegacyTable) {
    return;
  }

  const existing = getDb().select().from(microApps).all();
  if (existing.length > 0) {
    return;
  }

  const legacyRows = sqlite
    .prepare(
      "SELECT type, name, enabled FROM micro_apps ORDER BY created_at ASC",
    )
    .all() as Array<{ type: string; name: string; enabled: number }>;

  const legacyKnowledgeQuery = legacyRows.find((item) => item.type === "knowledge_query");
  if (!legacyKnowledgeQuery) {
    return;
  }

  getDb()
    .insert(microApps)
    .values({
      type: "knowledge_query",
      name: normalizeText(legacyKnowledgeQuery.name) || defaultDefinitionSeed.name,
      description: defaultDefinitionSeed.description,
      supportedAccessPointsJson: JSON.stringify(
        defaultDefinitionSeed.supportedAccessPoints,
      ),
      bindingSchemaJson: JSON.stringify(defaultDefinitionSeed.bindingSchema),
      runtimeKey: defaultDefinitionSeed.runtimeKey,
      enabled: Boolean(legacyKnowledgeQuery.enabled),
    })
    .run();
};

const toRecord = (row: typeof microApps.$inferSelect): MicroAppRecord => ({
  id: row.id,
  type: row.type as MicroAppType,
  name: normalizeText(row.name),
  description: normalizeText(row.description),
  supportedAccessPoints: parseJson<MicroAppSupportedAccessPoint[]>(
    row.supportedAccessPointsJson ?? "[]",
    [],
  ),
  bindingSchema: parseJson<MicroAppBindingSchema>(
    row.bindingSchemaJson ?? "{\"fields\":[]}",
    { fields: [] },
  ),
  runtimeKey: normalizeText(row.runtimeKey),
  enabled: Boolean(row.enabled),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const microAppsRepository = {
  initialize() {
    ensureTable();
    migrateFromLegacyMicroAppsTable();
    seedDefaults();
  },

  list(type?: MicroAppType) {
    const rows = type
      ? getDb()
          .select()
          .from(microApps)
          .where(eq(microApps.type, type))
          .orderBy(asc(microApps.createdAt))
          .all()
      : getDb()
          .select()
          .from(microApps)
          .orderBy(asc(microApps.type), asc(microApps.createdAt))
          .all();

    return rows.map(toRecord);
  },

  getById(id: string) {
    const row = getDb()
      .select()
      .from(microApps)
      .where(eq(microApps.id, id))
      .get();
    return row ? toRecord(row) : null;
  },

  getByType(type: MicroAppType) {
    const row = getDb()
      .select()
      .from(microApps)
      .where(eq(microApps.type, type))
      .get();
    return row ? toRecord(row) : null;
  },

  update(id: string, input: MicroAppInput) {
    const current = this.getById(id);
    if (!current) {
      return null;
    }

    const row = getDb()
      .update(microApps)
      .set({
        name: typeof input.name === "string" ? normalizeText(input.name) : current.name,
        description:
          typeof input.description === "string"
            ? normalizeText(input.description)
            : current.description,
        supportedAccessPointsJson: JSON.stringify(
          Array.isArray(input.supportedAccessPoints)
            ? input.supportedAccessPoints
            : current.supportedAccessPoints,
        ),
        bindingSchemaJson: JSON.stringify(input.bindingSchema ?? current.bindingSchema),
        runtimeKey:
          typeof input.runtimeKey === "string"
            ? normalizeText(input.runtimeKey)
            : current.runtimeKey,
        enabled: typeof input.enabled === "boolean" ? input.enabled : current.enabled,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(microApps.id, id))
      .returning()
      .get();

    return toRecord(row);
  },
};
