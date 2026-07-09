import { asc, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { microApps } from "../schema";

export type MicroAppType =
  | "knowledge_query"
  | "news_hub"
  | "image_generation"
  | "computer_use"
  | "tts";

export type MicroAppSupportedAccessPoint =
  | "wecom.smart_robot"
  | "desktop.news_hub"
  | "desktop.image_generation_studio"
  | "desktop.computer_use_studio"
  | "desktop.tts_studio";

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

export const newsHubBindingSchema: MicroAppBindingSchema = {
  fields: [],
};

export const imageGenerationBindingSchema: MicroAppBindingSchema = {
  fields: [
    {
      key: "providerId",
      label: "默认 Provider",
      type: "text",
      required: true,
      description: "声明这个微应用默认使用的生图 provider 标识。",
      placeholder: "openai_images",
      defaultValue: "openai_images",
    },
    {
      key: "model",
      label: "默认模型",
      type: "text",
      required: true,
      description: "声明这个微应用默认使用的生图模型。",
      placeholder: "gpt-image-1",
      defaultValue: "gpt-image-1",
    },
    {
      key: "defaultSize",
      label: "默认画幅",
      type: "text",
      required: true,
      description: "调试页初始使用的图片尺寸或画幅。",
      placeholder: "1024x1024",
      defaultValue: "1024x1024",
    },
    {
      key: "defaultStylePreset",
      label: "默认风格",
      type: "text",
      required: false,
      description: "调试页默认填充的风格预设名称。",
      placeholder: "natural",
      defaultValue: "natural",
    },
    {
      key: "workflowRunnerProfile",
      label: "Workflow Runner Profile",
      type: "text",
      required: false,
      description: "可选的本地 workflow runner 配置档标识。",
      placeholder: "comfyui_local_default",
      defaultValue: "",
    },
  ],
};

export const computerUseBindingSchema: MicroAppBindingSchema = {
  fields: [
    {
      key: "defaultStartUrl",
      label: "默认起始网址",
      type: "text",
      required: false,
      description: "工作台创建浏览器任务时默认填充的起始网址。",
      placeholder: "https://example.com",
      defaultValue: "",
    },
    {
      key: "allowedOrigins",
      label: "允许访问站点",
      type: "textarea",
      required: false,
      description: "限制第一阶段浏览器任务允许访问的站点列表，使用换行分隔。",
      placeholder: "https://example.com\nhttps://www.example.com",
      defaultValue: "",
    },
    {
      key: "requireApprovalForExternalNavigation",
      label: "外部跳转需审批",
      type: "switch",
      required: true,
      description: "当任务准备离开允许站点范围时，是否默认要求人工审批。",
      defaultValue: true,
    },
  ],
};

export const ttsBindingSchema: MicroAppBindingSchema = {
  fields: [
    {
      key: "defaultProviderId",
      label: "默认 Provider",
      type: "select",
      required: true,
      description: "工作台初始使用的语音合成 provider。",
      defaultValue: "windows_builtin",
      options: [
        { label: "Windows Built-in Voice", value: "windows_builtin" },
        { label: "Piper Local", value: "piper_local" },
      ],
    },
  ],
};

const defaultDefinitionSeeds: Array<
  Omit<MicroAppRecord, "id" | "createdAt" | "updatedAt">
> = [
  {
    type: "knowledge_query",
    name: "Knowledge Query",
    description: "接收外部问答入口的文本问题，调用本地知识库检索链路，并返回一条稳定文本回复。",
    supportedAccessPoints: ["wecom.smart_robot"],
    bindingSchema: defaultKnowledgeQuerySchema,
    runtimeKey: "knowledge-query",
    enabled: true,
  },
  {
    type: "news_hub",
    name: "News Hub",
    description:
      "为桌面内的 NewsHub 新闻聚合设置页保留共享注册定义和稳定 runtime key，不在这里承接外部接入点执行逻辑。",
    supportedAccessPoints: ["desktop.news_hub"],
    bindingSchema: newsHubBindingSchema,
    runtimeKey: "news_hub",
    enabled: true,
  },
  {
    type: "image_generation",
    name: "Image Generation",
    description: "为桌面内的生图调试工作区保留共享注册定义和稳定 runtime key，不在这里承接实际生成逻辑。",
    supportedAccessPoints: ["desktop.image_generation_studio"],
    bindingSchema: imageGenerationBindingSchema,
    runtimeKey: "image_generation",
    enabled: true,
  },
  {
    type: "computer_use",
    name: "Computer Use",
    description:
      "为桌面内的浏览器任务工作台保留共享注册定义和稳定 runtime key，不在这里承接实际浏览器执行逻辑。",
    supportedAccessPoints: ["desktop.computer_use_studio"],
    bindingSchema: computerUseBindingSchema,
    runtimeKey: "computer_use",
    enabled: true,
  },
  {
    type: "tts",
    name: "TTS",
    description:
      "为桌面内的语音合成工作台保留共享注册定义和稳定 runtime key，不在这里承接实际语音合成逻辑。",
    supportedAccessPoints: ["desktop.tts_studio"],
    bindingSchema: ttsBindingSchema,
    runtimeKey: "tts",
    enabled: true,
  },
];

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
  const existingTypes = new Set(
    getDb()
      .select({ type: microApps.type })
      .from(microApps)
      .all()
      .map((row) => row.type),
  );

  for (const definition of defaultDefinitionSeeds) {
    if (existingTypes.has(definition.type)) {
      continue;
    }

    getDb()
      .insert(microApps)
      .values({
        type: definition.type,
        name: definition.name,
        description: definition.description,
        supportedAccessPointsJson: JSON.stringify(definition.supportedAccessPoints),
        bindingSchemaJson: JSON.stringify(definition.bindingSchema),
        runtimeKey: definition.runtimeKey,
        enabled: definition.enabled,
      })
      .run();
  }
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
        name:
          normalizeText(legacyKnowledgeQuery.name) ||
          defaultDefinitionSeeds[0].name,
        description: defaultDefinitionSeeds[0].description,
        supportedAccessPointsJson: JSON.stringify(
          defaultDefinitionSeeds[0].supportedAccessPoints,
        ),
        bindingSchemaJson: JSON.stringify(defaultDefinitionSeeds[0].bindingSchema),
        runtimeKey: defaultDefinitionSeeds[0].runtimeKey,
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
