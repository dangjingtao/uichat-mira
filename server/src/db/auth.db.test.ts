import { createHash } from "node:crypto";
import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getSqlite, resetDatabaseClients, userRepository } from "@/db/index.js";
import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";
import {
  authenticateUser,
  changeUserPassword,
  createAccessToken,
  initializeAuthDatabase,
  verifyAccessToken,
} from "./auth.db.js";

const dbPath = createTimestampedTestArtifactPath("db", "p0-auth", ".sqlite");
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalAdminUsername = process.env.SEED_ADMIN_USERNAME;
const originalAdminPassword = process.env.SEED_ADMIN_PASSWORD;

describe("authentication database", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = `file:${dbPath}`;
    process.env.SEED_ADMIN_USERNAME = "p0-admin";
    process.env.SEED_ADMIN_PASSWORD = "initial-secret";
    resetDatabaseClients();
    initializeAuthDatabase();
  });

  afterAll(() => {
    resetDatabaseClients();
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalAdminUsername === undefined) delete process.env.SEED_ADMIN_USERNAME;
    else process.env.SEED_ADMIN_USERNAME = originalAdminUsername;
    if (originalAdminPassword === undefined) delete process.env.SEED_ADMIN_PASSWORD;
    else process.env.SEED_ADMIN_PASSWORD = originalAdminPassword;
    for (const suffix of ["", "-wal", "-shm"]) {
      fs.rmSync(`${dbPath}${suffix}`, { force: true });
    }
  });

  it("authenticates only active users with the correct password", () => {
    expect(authenticateUser("p0-admin", "initial-secret")).toMatchObject({
      username: "p0-admin",
      role: "admin",
    });
    expect(authenticateUser("p0-admin", "wrong-secret")).toBeNull();
    expect(authenticateUser("missing", "initial-secret")).toBeNull();

    const user = userRepository.findActiveByUsername("p0-admin");
    userRepository.update(user!.id, { isActive: false });
    expect(authenticateUser("p0-admin", "initial-secret")).toBeNull();
    userRepository.update(user!.id, { isActive: true });
  });

  it("changes passwords without accepting the old, wrong, or unchanged value", () => {
    const user = userRepository.findActiveByUsername("p0-admin")!;
    expect(changeUserPassword(user.id, "wrong-secret", "next-secret")).toEqual({
      ok: false,
      reason: "INVALID_CURRENT_PASSWORD",
    });
    expect(changeUserPassword(user.id, "initial-secret", "initial-secret")).toEqual({
      ok: false,
      reason: "PASSWORD_UNCHANGED",
    });
    expect(changeUserPassword(user.id, "initial-secret", "next-secret")).toMatchObject({
      ok: true,
      user: { id: user.id, username: "p0-admin" },
    });
    expect(authenticateUser("p0-admin", "initial-secret")).toBeNull();
    expect(authenticateUser("p0-admin", "next-secret")).toBeTruthy();
  });

  it("upgrades a valid legacy SHA-256 password hash after login", () => {
    const legacyHash = createHash("sha256").update("legacy-secret").digest("hex");
    const legacy = userRepository.create({
      username: "legacy-user",
      passwordHash: legacyHash,
      role: "user",
      isActive: true,
    });
    expect(authenticateUser("legacy-user", "legacy-secret")).toMatchObject({ id: legacy.id });
    const stored = getSqlite()
      .prepare("SELECT password_hash AS passwordHash FROM users WHERE id = ?")
      .get(legacy.id) as { passwordHash: string };
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(stored.passwordHash).not.toBe(legacyHash);
  });

  it("round-trips signed access tokens and rejects tampering", () => {
    const user = authenticateUser("p0-admin", "next-secret")!;
    const token = createAccessToken(user);
    expect(verifyAccessToken(token)).toEqual(user);
    expect(verifyAccessToken(`${token}tampered`)).toBeNull();
  });
});
