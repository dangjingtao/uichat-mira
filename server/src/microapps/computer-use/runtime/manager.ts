import AdmZip from "adm-zip";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  BrowserRuntimeDownloadRequest,
  BrowserRuntimeManagerOptions,
  BrowserRuntimeRecord,
  BrowserRuntimeStatus,
} from "./types.js";

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

    const parsed = JSON.parse(
      fs.readFileSync(this.metadataPath, "utf8"),
    ) as BrowserRuntimeRecord;

    if (!parsed.executablePath || !fs.existsSync(parsed.executablePath)) {
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
      status: "download_required",
      strategy: "download",
      inspectedCandidates,
      reason:
        "No managed Chromium or supported system browser was found. Install managed Chromium before execution.",
    };
  }

  async installManagedRuntime(
    request: BrowserRuntimeDownloadRequest,
  ): Promise<BrowserRuntimeRecord> {
    const archiveUrl = new URL(request.archiveUrl);
    if (!["https:", "http:"].includes(archiveUrl.protocol)) {
      throw new Error("Browser runtime download only supports http/https URLs.");
    }

    if (!isSafeRelativePath(request.executableRelativePath)) {
      throw new Error("Browser runtime executableRelativePath must stay inside the managed runtime directory.");
    }

    const archiveFilePath = path.join(
      this.downloadsRoot,
      `chromium-${request.version}.zip`,
    );

    const response = await this.fetchImpl(request.archiveUrl);
    if (!response.ok) {
      throw new Error(`Browser runtime download failed with status ${response.status}.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(archiveFilePath, buffer);

    const actualSha256 = sha256File(archiveFilePath);
    if (
      request.expectedSha256 &&
      actualSha256.toLowerCase() !== request.expectedSha256.toLowerCase()
    ) {
      throw new Error("Browser runtime archive SHA-256 mismatch.");
    }

    const installRoot = ensureDir(
      path.join(this.managedRoot, `chromium-${request.version}`),
    );
    for (const entry of this.archiveEntriesReader(archiveFilePath)) {
      const normalizedEntryName = entry.entryName.replace(/\\/g, "/");
      if (
        normalizedEntryName.startsWith("/") ||
        /^[a-zA-Z]:\//.test(normalizedEntryName)
      ) {
        throw new Error("Browser runtime archive contains an absolute entry path.");
      }

      const targetPath = resolveInsideRoot(installRoot, normalizedEntryName);
      if (entry.isDirectory) {
        ensureDir(targetPath);
        continue;
      }

      ensureDir(path.dirname(targetPath));
      fs.writeFileSync(targetPath, entry.getData());
    }

    const executablePath = path.join(
      installRoot,
      request.executableRelativePath,
    );
    if (!fs.existsSync(executablePath)) {
      throw new Error("Browser runtime executable was not found after extraction.");
    }

    const record: BrowserRuntimeRecord = {
      source: "managed",
      channel: "chromium",
      executablePath,
      version: request.version,
      installedAt: this.now().toISOString(),
      archiveSha256: actualSha256,
    };

    fs.writeFileSync(this.metadataPath, JSON.stringify(record, null, 2));
    return record;
  }
}
