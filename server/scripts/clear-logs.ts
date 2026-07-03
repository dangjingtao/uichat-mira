/**
 * 清理日志文件
 */
import fs from "node:fs";
import path from "node:path";

const LOG_DIR = path.resolve(process.cwd(), "logs");
const LOG_FILES = ["server.log", "error.log"];

const clearLogFile = (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

      // 清空文件而不是删除
      fs.writeFileSync(filePath, "", "utf8");
      console.log(
        `✅ 已清空 ${path.basename(filePath)} (之前大小: ${sizeMB}MB)`,
      );
    } else {
      console.log(`ℹ️ 文件不存在: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`❌ 清空文件失败 ${path.basename(filePath)}:`, error);
  }
};

const main = () => {
  console.log("🧹 开始清理日志文件...");
  console.log(`📍 日志目录: ${LOG_DIR}\n`);

  if (!fs.existsSync(LOG_DIR)) {
    console.log("ℹ️ 日志目录不存在，无需清理");
    return;
  }

  let totalSize = 0;
  for (const file of LOG_FILES) {
    const filePath = path.join(LOG_DIR, file);
    if (fs.existsSync(filePath)) {
      totalSize += fs.statSync(filePath).size;
    }
  }

  const totalMB = (totalSize / 1024 / 1024).toFixed(2);

  for (const file of LOG_FILES) {
    clearLogFile(path.join(LOG_DIR, file));
  }

  console.log(`\n✨ 清理完成！释放空间: ${totalMB}MB`);
};

main();
