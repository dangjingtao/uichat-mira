/**
 * 模型配置服务层
 */
import {
  openDatabase,
  ModelType,
  ModelConfigRecord,
  ParamTemplateRecord,
} from "@/db/model-config.db";

/** 模型配置响应类型 */
export interface ModelConfigResponse {
  id: string;
  type: ModelType;
  name: string;
  params: Record<string, any>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 参数模板响应类型 */
export interface ParamTemplateResponse {
  key: string;
  label: string;
  type: "number" | "select" | "boolean";
  step?: number;
  options?: { value: string; label: string }[];
  defaultValue: number | string | boolean;
}

/**
 * 模型配置服务
 */
export const modelConfigService = {
  /**
   * 获取指定类型的默认模型配置
   */
  async getDefaultConfig(type: ModelType): Promise<ModelConfigResponse | null> {
    const db = await openDatabase();
    try {
      const row = await db.get<ModelConfigRecord>(
        `SELECT * FROM model_configs 
         WHERE type = ? AND is_default = 1`,
        type,
      );

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        type: row.type,
        name: row.name,
        params: JSON.parse(row.params),
        isDefault: Boolean(row.is_default),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } finally {
      await db.close();
    }
  },

  /**
   * 获取所有类型的默认配置
   */
  async getAllDefaultConfigs(): Promise<ModelConfigResponse[]> {
    const db = await openDatabase();
    try {
      const rows = await db.all<ModelConfigRecord[]>(
        `SELECT * FROM model_configs WHERE is_default = 1`,
      );

      return rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        params: JSON.parse(row.params),
        isDefault: Boolean(row.is_default),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } finally {
      await db.close();
    }
  },

  /**
   * 更新指定类型的默认模型配置
   */
  async updateDefaultConfig(
    type: ModelType,
    data: { name?: string; params?: Record<string, any> },
  ): Promise<ModelConfigResponse | null> {
    const db = await openDatabase();
    try {
      // 获取当前配置
      const current = await db.get<ModelConfigRecord>(
        `SELECT * FROM model_configs WHERE type = ? AND is_default = 1`,
        type,
      );

      if (!current) {
        return null;
      }

      // 构建更新内容
      const newName = data.name !== undefined ? data.name : current.name;
      const currentParams = JSON.parse(current.params);
      const newParams = data.params
        ? { ...currentParams, ...data.params }
        : currentParams;

      // 更新数据库
      await db.run(
        `UPDATE model_configs 
         SET name = ?, params = ?, updated_at = datetime('now')
         WHERE type = ? AND is_default = 1`,
        newName,
        JSON.stringify(newParams),
        type,
      );

      // 返回更新后的配置
      return {
        id: current.id,
        type: current.type,
        name: newName,
        params: newParams,
        isDefault: true,
        createdAt: current.created_at,
        updatedAt: new Date().toISOString(),
      };
    } finally {
      await db.close();
    }
  },

  /**
   * 获取参数模板
   */
  async getParamTemplates(
    type?: ModelType,
  ): Promise<Record<ModelType, ParamTemplateResponse[]>> {
    const db = await openDatabase();
    try {
      let query = `SELECT * FROM model_param_templates`;
      const params: any[] = [];

      if (type) {
        query += ` WHERE model_type = ?`;
        params.push(type);
      }

      query += ` ORDER BY model_type, param_key`;

      const rows = await db.all<ParamTemplateRecord[]>(query, ...params);

      // 按类型分组
      const result: Record<ModelType, ParamTemplateResponse[]> = {
        llm: [],
        embedding: [],
        rerank: [],
      };

      for (const row of rows) {
        result[row.model_type as ModelType].push({
          key: row.param_key,
          label: row.param_label,
          type: row.param_type as "number" | "select" | "boolean",
          step: row.step ?? undefined,
          options: row.options ? JSON.parse(row.options) : undefined,
          defaultValue: JSON.parse(row.default_value),
        });
      }

      return result;
    } finally {
      await db.close();
    }
  },

  /**
   * 创建新的模型配置（非默认）
   */
  async createConfig(
    type: ModelType,
    name: string,
    params: Record<string, any>,
  ): Promise<ModelConfigResponse> {
    const db = await openDatabase();
    try {
      const result = await db.run(
        `INSERT INTO model_configs (type, name, params, is_default) VALUES (?, ?, ?, 0)`,
        type,
        name,
        JSON.stringify(params),
      );

      const now = new Date().toISOString();
      return {
        id: String(result.lastID),
        type,
        name,
        params,
        isDefault: false,
        createdAt: now,
        updatedAt: now,
      };
    } finally {
      await db.close();
    }
  },

  /**
   * 获取所有模型配置
   */
  async getAllConfigs(type?: ModelType): Promise<ModelConfigResponse[]> {
    const db = await openDatabase();
    try {
      let query = `SELECT * FROM model_configs`;
      const params: any[] = [];

      if (type) {
        query += ` WHERE type = ?`;
        params.push(type);
      }

      query += ` ORDER BY is_default DESC, created_at DESC`;

      const rows = await db.all<ModelConfigRecord[]>(query, ...params);

      return rows.map((row) => ({
        id: row.id,
        type: row.type,
        name: row.name,
        params: JSON.parse(row.params),
        isDefault: Boolean(row.is_default),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } finally {
      await db.close();
    }
  },

  /**
   * 删除模型配置
   */
  async deleteConfig(id: string): Promise<boolean> {
    const db = await openDatabase();
    try {
      const result = await db.run(
        `DELETE FROM model_configs WHERE id = ? AND is_default = 0`,
        id,
      );

      return (result?.changes ?? 0) > 0;
    } finally {
      await db.close();
    }
  },
};
