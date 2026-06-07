import { openDatabase } from "../src/db/model-config.db";

async function migrateDatabase() {
  const db = await openDatabase();

  try {
    console.log("开始检查和迁移数据库...");

    // 检查 model_configs 表是否有唯一约束
    const tableInfo = await db.all(`PRAGMA table_info(model_configs)`);
    console.log("当前表结构:", tableInfo);

    // 检查是否已有 (type, is_default) 唯一约束
    const indexes = await db.all(`PRAGMA index_list(model_configs)`);
    const hasUniqueConstraint = indexes.some(
      (idx: any) =>
        idx.unique === 1 || idx.name === "idx_model_configs_type_is_default",
    );

    if (hasUniqueConstraint) {
      console.log("唯一约束已存在，无需迁移");
      return;
    }

    console.log("需要添加唯一约束，开始迁移...");

    // 方法：创建新表，迁移数据，重命名
    await db.exec(`
      -- 创建临时表带唯一约束
      CREATE TABLE model_configs_new (
        id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        type TEXT NOT NULL CHECK (type IN ('llm', 'embedding', 'rerank')),
        name TEXT NOT NULL DEFAULT '',
        params TEXT NOT NULL DEFAULT '{}',
        is_default INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(type, is_default)
      );
      
      -- 迁移数据，保留每组最新的一条
      INSERT INTO model_configs_new (id, type, name, params, is_default, created_at, updated_at)
      SELECT id, type, name, params, is_default, created_at, updated_at
      FROM (
        SELECT *,
               ROW_NUMBER() OVER (PARTITION BY type, is_default ORDER BY created_at DESC) as rn
        FROM model_configs
      )
      WHERE rn = 1;
      
      -- 删除旧表
      DROP TABLE model_configs;
      
      -- 重命名新表
      ALTER TABLE model_configs_new RENAME TO model_configs;
      
      -- 重新创建索引
      CREATE INDEX IF NOT EXISTS idx_model_configs_type ON model_configs(type);
      CREATE INDEX IF NOT EXISTS idx_model_configs_default ON model_configs(type, is_default) WHERE is_default = 1;
    `);

    console.log("✅ 数据库迁移完成！");

    // 验证结果
    const count = await db.get(`SELECT COUNT(*) as cnt FROM model_configs`);
    console.log(`当前配置记录数: ${(count as any).cnt}`);
  } finally {
    await db.close();
  }
}

migrateDatabase().catch(console.error);
