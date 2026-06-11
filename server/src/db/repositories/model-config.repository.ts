import { and, eq } from "drizzle-orm";
import { getDb } from "../index";
import { modelConfigs, modelParamTemplates } from "../schema";
import { nowIso } from "@/utils/time.js";
import type {
  ModelConfig,
  ModelParamTemplate,
  ModelType,
  NewModelConfig,
  NewModelParamTemplate,
  ProviderCode,
} from "../schema";

export const modelConfigRepository = {
  findDefaultByType(type: ModelType): ModelConfig | undefined {
    const db = getDb();
    return db
      .select()
      .from(modelConfigs)
      .where(and(eq(modelConfigs.type, type), eq(modelConfigs.isDefault, true)))
      .limit(1)
      .get();
  },

  findAllDefaults(): ModelConfig[] {
    const db = getDb();
    return db
      .select()
      .from(modelConfigs)
      .where(eq(modelConfigs.isDefault, true))
      .all();
  },

  create(data: Omit<NewModelConfig, "id" | "createdAt" | "updatedAt">): ModelConfig {
    const db = getDb();
    return db
      .insert(modelConfigs)
      .values({
        ...data,
        isDefault: data.isDefault ?? false,
      })
      .returning()
      .get();
  },

  updateDefault(
    type: ModelType,
    data: {
      name?: string;
      params?: string;
      providerCode?: ProviderCode | null;
      remoteModelId?: string | null;
    },
  ): ModelConfig | undefined {
    const db = getDb();
    return db
      .update(modelConfigs)
      .set({
        ...data,
        updatedAt: nowIso(),
      })
      .where(and(eq(modelConfigs.type, type), eq(modelConfigs.isDefault, true)))
      .returning()
      .get();
  },

  upsertDefault(data: {
    type: ModelType;
    name: string;
    params: string;
    providerCode?: ProviderCode | null;
    remoteModelId?: string | null;
  }): ModelConfig {
    const db = getDb();
    const existing = this.findDefaultByType(data.type);

    if (existing) {
      return db
        .update(modelConfigs)
        .set({
          name: data.name,
          params: data.params,
          providerCode: data.providerCode ?? null,
          remoteModelId: data.remoteModelId ?? null,
          updatedAt: nowIso(),
        })
        .where(eq(modelConfigs.id, existing.id))
        .returning()
        .get();
    }

    return this.create({
      type: data.type,
      name: data.name,
      params: data.params,
      providerCode: data.providerCode ?? null,
      remoteModelId: data.remoteModelId ?? null,
      isDefault: true,
    });
  },
};

export const modelParamTemplateRepository = {
  findByModelType(modelType: ModelType): ModelParamTemplate[] {
    const db = getDb();
    return db
      .select()
      .from(modelParamTemplates)
      .where(eq(modelParamTemplates.modelType, modelType))
      .orderBy(modelParamTemplates.paramKey)
      .all();
  },

  findAll(): ModelParamTemplate[] {
    const db = getDb();
    return db
      .select()
      .from(modelParamTemplates)
      .orderBy(modelParamTemplates.modelType, modelParamTemplates.paramKey)
      .all();
  },

  create(data: Omit<NewModelParamTemplate, "id" | "createdAt">): ModelParamTemplate {
    const db = getDb();
    return db.insert(modelParamTemplates).values(data).returning().get();
  },

  upsert(data: Omit<NewModelParamTemplate, "id" | "createdAt">): ModelParamTemplate {
    const db = getDb();
    const existing = db
      .select()
      .from(modelParamTemplates)
      .where(
        and(
          eq(modelParamTemplates.modelType, data.modelType),
          eq(modelParamTemplates.paramKey, data.paramKey),
        ),
      )
      .limit(1)
      .get();

    if (existing) {
      return db
        .update(modelParamTemplates)
        .set({
          paramLabel: data.paramLabel,
          paramType: data.paramType,
          step: data.step,
          options: data.options,
          defaultValue: data.defaultValue,
        })
        .where(eq(modelParamTemplates.id, existing.id))
        .returning()
        .get();
    }

    return this.create(data);
  },
};
