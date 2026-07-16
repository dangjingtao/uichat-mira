import AdmZip from "adm-zip";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ComputerUseRuntimeManager } from "../runtime/manager.js";
import {
  DEFAULT_MANAGED_CHROMIUM_CONFIG,
  type ManagedChromiumConfig,
} from "../runtime/types.js";

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

const fixtureConfig = (
  overrides: Partial<ManagedChromiumConfig> = {},
): ManagedChromiumConfig => ({
  product: "chrome-for-testing",
  version: "141.0.0",
  archiveUrl: "https://example.com/chromium.zip",
  executableRelativePath: "chrome-win/chrome.exe",
  archiveSha256: "0".repeat(64),
  ...overrides,
});

afterEach(() => {
  for (const root of createdRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("ComputerUseRuntimeManager", () => {
  it("uses a fixed official managed Chromium package configuration", () => {
    expect(DEFAULT_MANAGED_CHROMIUM_CONFIG).toMatchObject({
      product: "chrome-for-testing",
      version: "152.0.7948.0",
      archiveUrl:
        "https://storage.googleapis.com/chrome-for-testing-public/152.0.7948.0/win64/chrome-win64.zip",
      executableRelativePath: "chrome-win64/chrome.exe",
      archiveSha256:
        "b9a7af5e9f1055561e4aac6322bd11bf6c22feac9c565ab5112ffea005a390f9",
    });
  });

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
        archiveSha256: "0".repeat(64),
      }),
    );

    const manager = new ComputerUseRuntimeManager({
      storageRoot,
      managedRuntimeConfig: fixtureConfig(),
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
      status: "not_installed",
      strategy: "download",
    });
  });

  it("does not treat a managed executable directory as a ready runtime", () => {
    const storageRoot = createTempRoot();
    const managedExecutable = path.join(
      storageRoot,
      "managed",
      "chromium-141.0.0",
      "chrome-win",
      "chrome.exe",
    );
    fs.mkdirSync(managedExecutable, { recursive: true });
    fs.writeFileSync(
      path.join(storageRoot, "managed", "managed-chromium.json"),
      JSON.stringify({
        source: "managed",
        channel: "chromium",
        executablePath: managedExecutable,
        version: "141.0.0",
        installedAt: "2026-07-06T00:00:00.000Z",
        archiveSha256: "0".repeat(64),
      }),
    );

    const resolved = new ComputerUseRuntimeManager({
      storageRoot,
      managedRuntimeConfig: fixtureConfig(),
      systemBrowserPaths: [],
    }).resolveRuntime();

    expect(resolved.status).toBe("not_installed");
  });

  it("rejects unsafe download requests before writing artifacts", async () => {
    const storageRoot = createTempRoot();
    const manager = new ComputerUseRuntimeManager({
      storageRoot,
      managedRuntimeConfig: fixtureConfig({
        archiveUrl: "file:///tmp/chromium.zip",
        executableRelativePath: "../chrome.exe",
      }),
      systemBrowserPaths: [],
    });

    await expect(
      manager.installManagedRuntime(),
    ).rejects.toThrow(/HTTPS/);

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
      managedRuntimeConfig: fixtureConfig({
        archiveSha256: expectedSha256Hex,
      }),
      fetchImpl: async () =>
        new Response(archiveBytes, {
          status: 200,
          headers: { "content-type": "application/zip" },
        }),
      now: () => new Date("2026-07-06T08:00:00.000Z"),
    });

    const record = await manager.installManagedRuntime();

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

    const resolved = manager.resolveRuntime();
    expect(resolved.status).toBe("ready");
    if (resolved.status === "ready") {
      expect(resolved.strategy).toBe("managed");
      expect(resolved.runtime.executablePath).toBe(record.executablePath);
    }
  });

  it("selects the first available system Chrome or Edge after managed Chromium", () => {
    const storageRoot = createTempRoot();
    const edgeExecutable = path.join(storageRoot, "system", "msedge.exe");
    createExecutable(edgeExecutable);

    const manager = new ComputerUseRuntimeManager({
      storageRoot,
      systemBrowserPaths: [
        {
          channel: "chrome",
          executablePath: path.join(storageRoot, "system", "missing-chrome.exe"),
        },
        { channel: "edge", executablePath: edgeExecutable, version: "edge-1" },
      ],
    });

    const resolved = manager.resolveRuntime();
    expect(resolved).toMatchObject({
      status: "ready",
      strategy: "system",
      runtime: { channel: "edge", executablePath: edgeExecutable },
    });
  });

  it("reuses a valid managed installation without downloading again", async () => {
    const storageRoot = createTempRoot();
    const archiveBytes = Buffer.from("not-a-real-zip");
    let fetchCount = 0;
    const manager = new ComputerUseRuntimeManager({
      storageRoot,
      systemBrowserPaths: [],
      managedRuntimeConfig: fixtureConfig({
        archiveSha256: crypto.createHash("sha256").update(archiveBytes).digest("hex"),
      }),
      fetchImpl: async () => {
        fetchCount += 1;
        return new Response(archiveBytes, { status: 200 });
      },
      archiveEntriesReader: () => [
        {
          entryName: "chrome-win/chrome.exe",
          isDirectory: false,
          getData: () => Buffer.from("browser"),
        },
      ],
    });

    const first = await manager.installManagedRuntime();
    const second = await manager.installManagedRuntime();

    expect(second).toEqual(first);
    expect(fetchCount).toBe(1);
  });

  it("rejects a checksum mismatch without creating managed metadata", async () => {
    const storageRoot = createTempRoot();
    const archiveBytes = Buffer.from("wrong-content");
    const manager = new ComputerUseRuntimeManager({
      storageRoot,
      systemBrowserPaths: [],
      managedRuntimeConfig: fixtureConfig({ archiveSha256: "f".repeat(64) }),
      fetchImpl: async () => new Response(archiveBytes, { status: 200 }),
    });

    await expect(manager.installManagedRuntime()).rejects.toThrow(
      /SHA-256 mismatch: expected/,
    );
    expect(
      fs.existsSync(path.join(storageRoot, "managed", "managed-chromium.json")),
    ).toBe(false);
  });

  it("reports a concrete download failure and leaves runtime unavailable", async () => {
    const storageRoot = createTempRoot();
    const manager = new ComputerUseRuntimeManager({
      storageRoot,
      systemBrowserPaths: [],
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
    });

    await expect(manager.installManagedRuntime()).rejects.toThrow(
      "Browser runtime download failed with status 503.",
    );
    expect(manager.resolveRuntime().status).toBe("not_installed");
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
      managedRuntimeConfig: fixtureConfig({
        version: "141.0.1",
        archiveUrl: "https://example.com/chromium-malicious.zip",
        archiveSha256: expectedSha256,
      }),
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
      manager.installManagedRuntime(),
    ).rejects.toThrow(/outside the managed runtime directory/);

    expect(fs.existsSync(path.join(storageRoot, "managed", "outside.txt"))).toBe(
      false,
    );
  });
});
