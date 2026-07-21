import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  BrowserRuntimeDownloadRequest,
  BrowserRuntimeManagerOptions,
  BrowserRuntimeRecord,
  BrowserRuntimeStatus,
  ManagedChromiumConfig,
} from "./types.js";
import { DEFAULT_MANAGED_CHROMIUM_CONFIG } from "./types.js";

const METADATA_FILE = "managed-chromium.json";

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
};

const resolveInsideRoot = (rootPath: string, entryPath: string) => {
  const targetPath = path.resolve(rootPath, entryPath);
  const normalizedRoot = path.resolve(rootPath);
  if (
    targetPath !== normalizedRoot &&
    !targetPath.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    throw new Error("Browser runtime archive contains an entry outside the managed runtime directory.");
  }
  return targetPath;
};

const sha256File = (filePath: string) => {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
};

const isWithin = (rootPath: string, targetPath: string) => {
  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  return target === root || target.startsWith(`${root}${path.sep}`);
};

const isRegularFile = (filePath: string) => {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const isSafeRelativePath = (relativePath: string) => {
  if (!relativePath || path.isAbsolute(relativePath)) {
    return false;
  }
  return !relativePath.split(/[\\/]+/).some((segment) => segment === "..");
};

const createDefaultSystemBrowserPaths = () => {
  const programFiles = process.env.PROGRAMFILES ?? "C:\\Program Files";
  const programFilesX86 =
    process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)";
  const localAppData =
    process.env.LOCALAPPDATA ??
    path.join(process.env.USERPROFILE ?? "C:\\Users\\Default", "AppData", "Local");

  return [
    {
      channel: "chrome" as const,
      executablePath: path.join(
        programFiles,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
      version: "system-detected",
    },
    {
      channel: "chrome" as const,
      executablePath: path.join(
        programFilesX86,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
      version: "system-detected",
    },
    {
      channel: "chrome" as const,
      executablePath: path.join(
        localAppData,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      ),
      version: "system-detected",
    },
    {
      channel: "edge" as const,
      executablePath: path.join(
        programFiles,
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe",
      ),
      version: "system-detected",
    },
    {
      channel: "edge" as const,
      executablePath: path.join(
        programFilesX86,
        "Microsoft",
        "Edge",
        "Application",
        "msedge.exe",
      ),
      version: "system-detected",
    },
  ];
};

export class ComputerUseRuntimeManager {
  private readonly storageRoot: string;
  private readonly managedRoot: string;
  private readonly downloadsRoot: string;
  private readonly metadataPath: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly managedRuntimeConfig: ManagedChromiumConfig;
  private readonly systemBrowserPaths: BrowserRuntimeManagerOptions["systemBrowserPaths"];
  private readonly archiveEntriesReader: NonNullable<
    BrowserRuntimeManagerOptions["archiveEntriesReader"]
  >;

  constructor(options: BrowserRuntimeManagerOptions) {
    this.storageRoot = ensureDir(options.storageRoot);
    this.managedRoot = ensureDir(path.join(this.storageRoot, "managed"));
    this.downloadsRoot = ensureDir(path.join(this.storageRoot, "downloads"));
    this.metadataPath = path.join(this.managedRoot, METADATA_FILE);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.managedRuntimeConfig =
      options.managedRuntimeConfig ?? DEFAULT_MANAGED_CHROMIUM_CONFIG;
    this.systemBrowserPaths =
      options.systemBrowserPaths ?? createDefaultSystemBrowserPaths();
    this.archiveEntriesReader =
      options.archiveEntriesReader ??
      ((archiveFilePath) => new AdmZip(archiveFilePath).getEntries());
  }

  inspectManagedRuntime(): BrowserRuntimeRecord | null {
    if (!fs.existsSync(this.metadataPath)) {
      return null;
    }

    let parsed: BrowserRuntimeRecord;
    try {
      parsed = JSON.parse(fs.readFileSync(this.metadataPath, "utf8")) as BrowserRuntimeRecord;
    } catch {
      return null;
    }

    const expectedRoot = path.join(
      this.managedRoot,
      `chromium-${this.managedRuntimeConfig.version}`,
    );
    if (
      parsed.source !== "managed" ||
      parsed.channel !== "chromium" ||
      parsed.version !== this.managedRuntimeConfig.version ||
      parsed.archiveSha256?.toLowerCase() !==
        this.managedRuntimeConfig.archiveSha256.toLowerCase() ||
      !parsed.executablePath ||
      !isWithin(expectedRoot, parsed.executablePath) ||
      !isRegularFile(parsed.executablePath)
    ) {
      return null;
    }

    return { ...parsed, source: "managed", channel: "chromium" };
  }

  inspectSystemBrowsers(): BrowserRuntimeRecord[] {
    return (this.systemBrowserPaths ?? [])
      .filter((candidate) => fs.existsSync(candidate.executablePath))
      .map((candidate) => ({
        source: "system" as const,
        channel: candidate.channel,
        executablePath: candidate.executablePath,
        version: candidate.version ?? "system-detected",
        installedAt: this.now().toISOString(),
      }));
  }

  resolveRuntime(): BrowserRuntimeStatus {
    const managed = this.inspectManagedRuntime();
    const system = this.inspectSystemBrowsers();
    const inspectedCandidates = [
      ...(managed ? [managed] : []),
      ...system,
    ];

    if (managed) {
      return {
        status: "ready",
        runtime: managed,
        strategy: "managed",
        inspectedCandidates,
      };
    }

    if (system.length > 0) {
      return {
        status: "ready",
        runtime: system[0]!,
        strategy: "system",
        inspectedCandidates,
      };
    }

    return {
      status: "not_installed",
      strategy: "download",
      inspectedCandidates,
      reason:
        "No managed Chromium or supported system browser was found. Install managed Chromium before execution.",
    };
  }

  async installManagedRuntime(
    request?: BrowserRuntimeDownloadRequest,
    options?: { force?: boolean },
  ): Promise<BrowserRuntimeRecord> {
    const config = this.managedRuntimeConfig;
    if (
      request &&
      (request.version !== config.version ||
        request.archiveUrl !== config.archiveUrl ||
        request.executableRelativePath !== config.executableRelativePath ||
        (request.expectedSha256 ?? config.archiveSha256).toLowerCase() !==
          config.archiveSha256.toLowerCase())
    ) {
      throw new Error(
        "Browser runtime install request does not match the fixed managed Chromium configuration.",
      );
    }
    const archiveUrl = new URL(config.archiveUrl);
    if (archiveUrl.protocol !== "https:") {
      throw new Error("Browser runtime download only supports HTTPS URLs.");
    }

    if (!isSafeRelativePath(config.executableRelativePath)) {
      throw new Error("Browser runtime executableRelativePath must stay inside the managed runtime directory.");
    }

    const existing = this.inspectManagedRuntime();
    if (existing && !options?.force) {
      return existing;
    }

    const archiveFilePath = path.join(
      this.downloadsRoot,
      `chromium-${config.version}-${crypto.randomUUID()}.zip`,
    );

    const installRoot = path.join(this.managedRoot, `chromium-${config.version}`);
    const partialRoot = `${installRoot}.partial-${crypto.randomUUID()}`;
    try {
      let response: Response;
      try {
        response = await this.fetchImpl(config.archiveUrl);
      } catch (error) {
        throw new Error(
          `Browser runtime download failed: ${error instanceof Error ? error.message : String(error)}.`,
        );
      }
      if (!response.ok) {
        throw new Error(`Browser runtime download failed with status ${response.status}.`);
      }

      fs.writeFileSync(archiveFilePath, Buffer.from(await response.arrayBuffer()));
      const actualSha256 = sha256File(archiveFilePath);
      if (actualSha256.toLowerCase() !== config.archiveSha256.toLowerCase()) {
        throw new Error(
          `Browser runtime archive SHA-256 mismatch: expected ${config.archiveSha256}, got ${actualSha256}.`,
        );
      }

      ensureDir(partialRoot);
      for (const entry of this.archiveEntriesReader(archiveFilePath)) {
        const normalizedEntryName = entry.entryName.replace(/\\/g, "/");
        if (
          normalizedEntryName.startsWith("/") ||
          /^[a-zA-Z]:\//.test(normalizedEntryName)
        ) {
          throw new Error("Browser runtime archive contains an absolute entry path.");
        }

        const targetPath = resolveInsideRoot(partialRoot, normalizedEntryName);
        if (entry.isDirectory) {
          ensureDir(targetPath);
          continue;
        }
        ensureDir(path.dirname(targetPath));
        fs.writeFileSync(targetPath, entry.getData());
      }

      const executablePath = path.join(partialRoot, config.executableRelativePath);
      if (!isWithin(partialRoot, executablePath) || !isRegularFile(executablePath)) {
        throw new Error("Browser runtime executable was not found after extraction.");
      }

      fs.rmSync(installRoot, { recursive: true, force: true });
      fs.renameSync(partialRoot, installRoot);
      const record: BrowserRuntimeRecord = {
        source: "managed",
        channel: "chromium",
        executablePath: path.join(installRoot, config.executableRelativePath),
        version: config.version,
        installedAt: this.now().toISOString(),
        archiveSha256: actualSha256,
      };
      const metadataTempPath = `${this.metadataPath}.tmp-${crypto.randomUUID()}`;
      fs.writeFileSync(metadataTempPath, JSON.stringify(record, null, 2));
      fs.renameSync(metadataTempPath, this.metadataPath);
      return record;
    } catch (error) {
      fs.rmSync(partialRoot, { recursive: true, force: true });
      throw error;
    } finally {
      fs.rmSync(archiveFilePath, { force: true });
    }
  }
}
