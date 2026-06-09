import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ERROR_LOG_FILE, LOG_DIR, LOG_FILE } from "@/logger";

const execFileAsync = promisify(execFile);
const LOG_FILES = [
  { name: "server.log", path: LOG_FILE },
  { name: "error.log", path: ERROR_LOG_FILE },
] as const;

const quotePowerShellPath = (value: string) => `'${value.replace(/'/g, "''")}'`;

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

const runCompressArchive = async (sourcePaths: string[], destinationPath: string) => {
  const sourceArray = sourcePaths.map(quotePowerShellPath).join(", ");
  const command = [
    "$ErrorActionPreference = 'Stop'",
    `Compress-Archive -LiteralPath @(${sourceArray}) -DestinationPath ${quotePowerShellPath(destinationPath)} -Force`,
  ].join("; ");

  const shellCandidates = process.platform === "win32"
    ? ["powershell.exe", "pwsh.exe", "pwsh"]
    : ["pwsh"];

  let lastError: unknown;

  for (const shell of shellCandidates) {
    try {
      await execFileAsync(shell, ["-NoProfile", "-NonInteractive", "-Command", command], {
        windowsHide: true,
      });
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to create log archive");
};

export interface ClearedLogFileSummary {
  name: string;
  previousSize: number;
}

export const logFilesService = {
  async exportLogsArchive() {
    await ensureLogFilesExist();

    const tempZipPath = path.join(
      os.tmpdir(),
      `ui-chat-rag-logs-${Date.now()}.zip`,
    );

    await runCompressArchive(
      LOG_FILES.map((file) => file.path),
      tempZipPath,
    );

    try {
      const buffer = await fs.readFile(tempZipPath);
      return {
        fileName: `ui-chat-rag-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`,
        buffer,
      };
    } finally {
      await fs.rm(tempZipPath, { force: true });
    }
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
