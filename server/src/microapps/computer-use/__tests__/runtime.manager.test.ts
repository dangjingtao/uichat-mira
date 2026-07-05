import AdmZip from "adm-zip";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ComputerUseRuntimeManager } from "../runtime/manager.js";

const testRoot = path.join(
  process.cwd(),
  ".test-artifact",
  "computer-use",
  "runtime-tests",
);

const createdRoots: string[] = [];

const createTempRoot = () => {
  fs.mkdirSync(testRoot, { recursive: true });
  const dir = fs.mkdtempSync(path.join(testRoot, "case-"));
  createdRoots.push(dir);
  return dir;
};

const createExecutable = (filePath: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "echo browser");
};

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ComputerUseRuntimeManager", () => {
  it("prefers managed Chromium over system browsers", () => {
    const storageRoot = createTempRoot();
    const managedExecutable = path.join(
      storageRoot,
      "managed",
      "chromium-141.0.0",
      "chrome-win",
      "chrome.exe",
    );
    const systemExecutable = path.join(storageRoot, "system", "chrome.exe");
    createExecutable(managedExecutable);
    createExecutable(systemExecutable);

    fs.writeFileSync(
      path.join(storageRoot, "managed", "managed-chromium.json"),
      JSON.stringify({
        source: "managed",
        channel: "chromium",
        executablePath: managedExecutable,
        version: "141.0.0",
        installedAt: "2026-07-06T00:00:00.000Z",
      }),
    );

    const manager = new ComputerUseRuntimeManager({
      storageRoot,
      systemBrowserPaths: [
        {
          channel: "chrome",
          executablePath: systemExecutable,
          version: "system-1",
        },
      ],
    });

    const resolved = manager.resolveRuntime();

    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") {
      return;
    }
    expect(resolved.strategy).toBe("managed");
    expect(resolved.runtime.executablePath).toBe(managedExecutable);
    expect(resolved.inspectedCandidates).toHaveLength(2);
  });

  it("falls back to download when no managed or system browser exists", () => {
    const manager = new ComputerUseRuntimeManager({
      storageRoot: createTempRoot(),
      systemBrowserPaths: [],
    });

    const resolved = manager.resolveRuntime();

    expect(resolved).toMatchObject({
      status: "download_required",
      strategy: "download",
    });
  });

  it("rejects unsafe download requests before writing artifacts", async () => {
    const storageRoot = createTempRoot();
    const manager = new ComputerUseRuntimeManager({
      storageRoot,
      systemBrowserPaths: [],
    });

    await expect(
      manager.installManagedRuntime({
        version: "141.0.0",
        archiveUrl: "file:///tmp/chromium.zip",
        executableRelativePath: "../chrome.exe",
      }),
    ).rejects.toThrow(/http\/https|managed runtime directory/);

    expect(fs.readdirSync(path.join(storageRoot, "downloads"))).toHaveLength(0);
  });

  it("downloads, extracts and records managed Chromium metadata", async () => {
    const storageRoot = createTempRoot();
    const archivePath = path.join(storageRoot, "fixture.zip");
    const zip = new AdmZip();
    zip.addFile("chrome-win/chrome.exe", Buffer.from("browser"));
    zip.writeZip(archivePath);

    const archiveBytes = fs.readFileSync(archivePath);
    const expectedSha256 = await crypto.subtle.digest("SHA-256", archiveBytes);
    const expectedSha256Hex = Buffer.from(expectedSha256).toString("hex");

    const manager = new ComputerUseRuntimeManager({
      storageRoot,
      systemBrowserPaths: [],
      fetchImpl: async () =>
        new Response(archiveBytes, {
          status: 200,
          headers: { "content-type": "application/zip" },
        }),
      now: () => new Date("2026-07-06T08:00:00.000Z"),
    });

    const record = await manager.installManagedRuntime({
      version: "141.0.0",
      archiveUrl: "https://example.com/chromium.zip",
      executableRelativePath: "chrome-win/chrome.exe",
      expectedSha256: expectedSha256Hex,
    });

    expect(record).toMatchObject({
      source: "managed",
      channel: "chromium",
      version: "141.0.0",
      installedAt: "2026-07-06T08:00:00.000Z",
      archiveSha256: expectedSha256Hex,
    });
    expect(fs.existsSync(record.executablePath)).toBe(true);
    expect(
      fs.existsSync(path.join(storageRoot, "managed", "managed-chromium.json")),
    ).toBe(true);
  });

  it("rejects archive entries that try to escape the managed runtime directory", async () => {
    const storageRoot = createTempRoot();
    const archiveBytes = Buffer.from("malicious-archive");
    const expectedSha256 = crypto
      .createHash("sha256")
      .update(archiveBytes)
      .digest("hex");

    const manager = new ComputerUseRuntimeManager({
      storageRoot,
      systemBrowserPaths: [],
      fetchImpl: async () =>
        new Response(archiveBytes, {
          status: 200,
          headers: { "content-type": "application/zip" },
        }),
      archiveEntriesReader: () => [
        {
          entryName: "chrome-win/chrome.exe",
          isDirectory: false,
          getData: () => Buffer.from("browser"),
        },
        {
          entryName: "../outside.txt",
          isDirectory: false,
          getData: () => Buffer.from("escape"),
        },
      ],
    });

    await expect(
      manager.installManagedRuntime({
        version: "141.0.1",
        archiveUrl: "https://example.com/chromium-malicious.zip",
        executableRelativePath: "chrome-win/chrome.exe",
        expectedSha256,
      }),
    ).rejects.toThrow(/outside the managed runtime directory/);

    expect(fs.existsSync(path.join(storageRoot, "managed", "outside.txt"))).toBe(
      false,
    );
  });
});
