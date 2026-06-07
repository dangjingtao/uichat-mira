import fs from "node:fs/promises";
import path from "node:path";

const DB_PATH = path.resolve(process.cwd(), "data", "uichat-rag-test.db");

async function resetDatabase() {
  console.log("准备重置数据库...");

  try {
    // 检查数据库文件是否存在
    await fs.access(DB_PATH);

    // 备份旧数据库
    const backupPath = `${DB_PATH}.backup.${Date.now()}`;
    await fs.rename(DB_PATH, backupPath);
    console.log(`旧数据库已备份到: ${backupPath}`);

    // 确保 data 目录存在
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });

    console.log("数据库已重置，下次启动服务器时会自动创建新数据库！");
  } catch (err: any) {
    if (err.code === "ENOENT") {
      console.log("数据库文件不存在，无需重置");
    } else {
      console.error("重置数据库时出错:", err);
      throw err;
    }
  }
}

resetDatabase().catch(console.error);
