/**
 * 模型配置数据访问层
 */
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../index";
import { modelConfigs, modelParamTemplates } from "../schema";
import type { NewModelConfig, ModelConfig, NewModelParamTemplate, ModelParamTemplate, ModelType } from "../schema";

/**
 * 模型配置 Repository
 */
export const modelConfigRepository = {
  /**
   * 获取指定类型的默认配置
   */
  findDefaultByType(type: ModelType): ModelConfig | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(modelConfigs)
      .where(
        and(
          eq(modelConfigs.type, type),
          eq(modelConfigs.isDefault, true)
        )
      )
      .limit(1)
      .get();
    return result;
  },

  /**
   * 获取所有默认配置
   */
  findAllDefaults(): ModelConfig[] {
    const db = getDb();
    return db
      .select()
      .from(modelConfigs)
      .where(eq(modelConfigs.isDefault, true))
      .all();
  },

  /**
   * 根据 ID 获取配置
   */
  findById(id: string): ModelConfig | undefined {
    const db = getDb();
    const result = db
      .select()
      .from(modelConfigs)
      .where(eq(modelConfigs.id, id))
      .limit(1)
      .get();
    return result;
  },

  /**
   * 根据类型获取所有配置
   */
  findByType(type: ModelType): ModelConfig[] {
    const db = getDb();
    return db
      .select()
      .from(modelConfigs)
      .where(eq(modelConfigs.type, type))
      .orderBy(desc(modelConfigs.isDefault), desc(modelConfigs.createdAt))
      .all();
  },

  /**
   * 获取所有配置
   */
  findAll(): ModelConfig[] {
    const db = getDb();
    return db
      .select()
      .from(modelConfigs)
      .orderBy(desc(modelConfigs.isDefault), desc(modelConfigs.createdAt))
      .all();
  },

  /**
   * 创建配置
   */
  create(data: Omit<NewModelConfig, "id" | "createdAt" | "updatedAt">): ModelConfig {
    const db = getDb();
    const result = db.insert(modelConfigs).values({
      ...data,
      isDefault: data.isDefault ?? false,
    }).returning().get();
    return result;
  },

  /**
   * 更新默认配置
   */
  updateDefault(type: ModelType, data: { name?: string; params?: string }): ModelConfig | undefined {
    const db = getDb();
    const result = db
      .update(modelConfigs)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(modelConfigs.type, type),
          eq(modelConfigs.isDefault, true)
        )
      )
      .returning()
      .get();
    return result;
  },

  /**
   * 删除配置（非默认）
   */
  delete(id: string): boolean {
    const db = getDb();
    // 只允许删除非默认配置
    const result = db
      .delete(modelConfigs)
      .where(
        and(
          eq(modelConfigs.id, id),
          eq(modelConfigs.isDefault, false)
        )
      )
      .run();
    return result.changes > 0;
  },

  /**
   * 批量插入或更新默认配置（upsert）
   */
  upsertDefault(data: { type: ModelType; name: string; params: string }): ModelConfig {
    const db = getDb();
    const existing = this.findDefaultByType(data.type);

    if (existing) {
      return db
        .update(modelConfigs)
        .set({
          name: data.name,
          params: data.params,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(modelConfigs.id, existing.id))
        .returning()
        .get();
    }

    return this.create({
      type: data.type,
      name: data.name,
      params: data.params,
      isDefault: true,
    });
  },
};

/**
 * 参数模板 Repository
 */
export const modelParamTemplateRepository = {
  /**
   * 根据模型类型获取参数模板
   */
  findByModelType(modelType: ModelType): ModelParamTemplate[] {
    const db = getDb();
    return db
      .select()
      .from(modelParamTemplates)
      .where(eq(modelParamTemplates.modelType, modelType))
      .orderBy(modelParamTemplates.paramKey)
      .all();
  },

  /**
   * 获取所有参数模板
   */
  findAll(): ModelParamTemplate[] {
    const db = getDb();
    return db
      .select()
      .from(modelParamTemplates)
      .orderBy(modelParamTemplates.modelType, modelParamTemplates.paramKey)
      .all();
  },

  /**
   * 创建参数模板
   */
  create(data: Omit<NewModelParamTemplate, "id" | "createdAt">): ModelParamTemplate {
    const db = getDb();
    const result = db.insert(modelParamTemplates).values(data).returning().get();
    return result;
  },

  /**
   * 批量插入或更新参数模板
   */
  upsert(data: Omit<NewModelParamTemplate, "id" | "createdAt">): ModelParamTemplate {
    const db = getDb();
    const existing = db
      .select()
      .from(modelParamTemplates)
      .where(
        and(
          eq(modelParamTemplates.modelType, data.modelType),
          eq(modelParamTemplates.paramKey, data.paramKey)
        )
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

  /**
   * 批量 upsert
   */
  upsertMany(items: Array<Omit<NewModelParamTemplate, "id" | "createdAt">>): void {
    for (const item of items) {
      this.upsert(item);
    }
  },
};
