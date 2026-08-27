import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSqlite, resetDatabaseClients } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import { generalSettingsRepository } from "./general-settings.repository.js";

const dbPath = createTimestampedTestArtifactPath("db", "p0-general-settings", ".sqlite");
const originalDatabaseUrl = process.env.DATABASE_URL;

describe("general settings repository", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = `file:${dbPath}`;
    resetDatabaseClients();
    generalSettingsRepository.initialize();
  });

  afterAll(() => {
    resetDatabaseClients();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    for (const suffix of ["", "-wal", "-shm"]) {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    }
  });

  it("creates one default row and returns normalized defaults", () => {
    expect(generalSettingsRepository.get()).toEqual({
      socks5Host: "",
      socks5Port: 0,
      socks5Username: "",
      socks5Password: "",
    });
    const count = getSqlite()
      .prepare("SELECT COUNT(*) AS count FROM general_settings")
      .get() as { count: number };
    expect(count.count).toBe(1);
  });

  it("normalizes fields, encrypts the password at rest, and decrypts it on read", () => {
    const updated = generalSettingsRepository.update({
      socks5Host: "  proxy.internal  ",
      socks5Port: 1080.9,
      socks5Username: "  alice  ",
      socks5Password: "  private-secret  ",
    });
    expect(updated).toEqual({
      socks5Host: "proxy.internal",
      socks5Port: 1080,
      socks5Username: "alice",
      socks5Password: "private-secret",
    });

    const stored = getSqlite()
      .prepare("SELECT socks5_password_encrypted AS encrypted FROM general_settings LIMIT 1")
      .get() as { encrypted: string };
    expect(stored.encrypted).not.toContain("private-secret");
    expect(stored.encrypted.split(".")).toHaveLength(3);
  });

  it("preserves omitted values and converts invalid ports to the disabled value", () => {
    expect(generalSettingsRepository.update({ socks5Port: 70000 })).toEqual({
      socks5Host: "proxy.internal",
      socks5Port: 0,
      socks5Username: "alice",
      socks5Password: "private-secret",
    });
    expect(generalSettingsRepository.update({ socks5Password: "" }).socks5Password).toBe("");
  });
});
