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
      status: "download_required";
      strategy: "download";
      inspectedCandidates: BrowserRuntimeRecord[];
      reason: string;
    };

export type BrowserRuntimeDownloadRequest = {
  version: string;
  archiveUrl: string;
  executableRelativePath: string;
  expectedSha256?: string;
};

export type BrowserRuntimeManagerOptions = {
  storageRoot: string;
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
