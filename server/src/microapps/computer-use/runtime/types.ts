export type BrowserRuntimeSource = "managed" | "system";

export type BrowserRuntimeRecord = {
  source: BrowserRuntimeSource;
  channel: "chromium" | "chrome" | "edge";
  executablePath: string;
  version: string;
  installedAt: string;
  archiveSha256?: string;
};

export type BrowserRuntimeStatus =
  | {
      status: "ready";
      runtime: BrowserRuntimeRecord;
      strategy: "managed" | "system";
      inspectedCandidates: BrowserRuntimeRecord[];
    }
  | {
      status: "not_installed";
      strategy: "download";
      inspectedCandidates: BrowserRuntimeRecord[];
      reason: string;
    };

export type ManagedChromiumConfig = {
  product: "chrome-for-testing";
  version: string;
  archiveUrl: string;
  executableRelativePath: string;
  archiveSha256: string;
};

export const DEFAULT_MANAGED_CHROMIUM_CONFIG: ManagedChromiumConfig =
  Object.freeze({
    product: "chrome-for-testing",
    version: "152.0.7948.0",
    archiveUrl:
      "https://storage.googleapis.com/chrome-for-testing-public/152.0.7948.0/win64/chrome-win64.zip",
    executableRelativePath: "chrome-win64/chrome.exe",
    archiveSha256:
      "b9a7af5e9f1055561e4aac6322bd11bf6c22feac9c565ab5112ffea005a390f9",
  });

export const MANAGED_CHROMIUM_CONFIG = DEFAULT_MANAGED_CHROMIUM_CONFIG;

export type BrowserRuntimeDownloadRequest = {
  version: string;
  archiveUrl: string;
  executableRelativePath: string;
  expectedSha256?: string;
};

export type BrowserRuntimeManagerOptions = {
  storageRoot: string;
  managedRuntimeConfig?: ManagedChromiumConfig;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  systemBrowserPaths?: Array<{
    channel: "chrome" | "edge";
    executablePath: string;
    version?: string;
  }>;
  archiveEntriesReader?: (
    archiveFilePath: string,
  ) => Array<{
    entryName: string;
    isDirectory: boolean;
    getData(): Buffer;
  }>;
};
