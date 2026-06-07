/**
 * 日志配置
 */
import fs from "node:fs";
import path from "node:path";

// 确保 logs 目录存在
const LOG_DIR = path.resolve(process.cwd(), "logs");
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {}

const LOG_FILE = path.join(LOG_DIR, "server.log");
const ERROR_LOG_FILE = path.join(LOG_DIR, "error.log");

/**
 * 创建日志流
 */
export const createLogStreams = () => {
  const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  const errorStream = fs.createWriteStream(ERROR_LOG_FILE, { flags: "a" });

  return {
    LOG_DIR,
    LOG_FILE,
    ERROR_LOG_FILE,
    logStream,
    errorStream,
  };
};

/**
 * Fastify 日志配置
 */
export const getLoggerConfig = () => {
  const { logStream, errorStream } = createLogStreams();

  return {
    level: "info",
    stream: {
      write: (log: string) => {
        // 输出到控制台
        console.log(log.trim());

        // 输出到文件
        try {
          logStream.write(log);

          // 错误日志同时写到错误文件
          const logObj = JSON.parse(log);
          if (logObj.level >= 40) {
            errorStream.write(log);
          }
        } catch {}
      },
    },
  };
};

export default {
  LOG_DIR,
  LOG_FILE,
  ERROR_LOG_FILE,
  createLogStreams,
  getLoggerConfig,
};
