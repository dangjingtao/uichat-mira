import fs from "node:fs/promises";
import AdmZip from "adm-zip";
import { ERROR_LOG_FILE, LOG_DIR, LOG_FILE } from "@/logger";
import { nowIsoForFileName } from "@/utils/time.js";
const LOG_FILES = [
  { name: "server.log", path: LOG_FILE },
  { name: "error.log", path: ERROR_LOG_FILE },
] as const;

const ensureLogFilesExist = async () => {
  await fs.mkdir(LOG_DIR, { recursive: true });
  await Promise.all(
    LOG_FILES.map(async (file) => {
      try {
        await fs.access(file.path);
      } catch {
        await fs.writeFile(file.path, "", "utf8");
      }
    }),
  );
};

export interface ClearedLogFileSummary {
  name: string;
  previousSize: number;
}

export const logFilesService = {
  async exportLogsArchive() {
    await ensureLogFilesExist();
    const archive = new AdmZip();

    const logEntries = await Promise.all(
      LOG_FILES.map(async (file) => ({
        name: file.name,
        content: await fs.readFile(file.path),
      })),
    );

    for (const entry of logEntries) {
      archive.addFile(entry.name, entry.content);
    }

    return {
      fileName: `ui-chat-rag-logs-${nowIsoForFileName()}.zip`,
      buffer: archive.toBuffer(),
    };
  },

  async clearLogs() {
    await ensureLogFilesExist();

    const clearedFiles = await Promise.all(
      LOG_FILES.map(async (file): Promise<ClearedLogFileSummary> => {
        const stats = await fs.stat(file.path);
        await fs.truncate(file.path, 0);
        return {
          name: file.name,
          previousSize: stats.size,
        };
      }),
    );

    return {
      directory: LOG_DIR,
      clearedFiles,
    };
  },
};
