import { openDatabase } from "../src/db/model-config.db";

async function cleanupDuplicateData() {
  const db = await openDatabase();

  try {
    console.log("开始清理重复数据...");

    // 检查现有数据
    const allConfigs = await db.all(
      `SELECT * FROM model_configs ORDER BY type, created_at`,
    );
    console.log(`当前共有 ${allConfigs.length} 条配置记录`);

    // 查找重复记录
    const duplicates = await db.all(`
      SELECT type, is_default, COUNT(*) as count
      FROM model_configs
      GROUP BY type, is_default
      HAVING count > 1
    `);

    if (duplicates.length > 0) {
      console.log(`发现 ${duplicates.length} 组重复数据`);

      // 保留每组最新的一条记录
      await db.exec(`
        DELETE FROM model_configs
        WHERE id NOT IN (
          SELECT id
          FROM (
            SELECT id, type, is_default,
                   ROW_NUMBER() OVER (PARTITION BY type, is_default ORDER BY created_at DESC) as rn
            FROM model_configs
          )
          WHERE rn = 1
        )
      `);

      console.log("重复数据已清理");
    }

    // 验证清理结果
    const remaining = await db.all(
      `SELECT * FROM model_configs ORDER BY type, created_at`,
    );
    console.log(`清理后剩余 ${remaining.length} 条配置记录`);
    console.log("清理完成！");
  } finally {
    await db.close();
  }
}

cleanupDuplicateData().catch(console.error);
