/**
 * 认证模块
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import jwt from "jsonwebtoken";
import { getSqlite, userRepository } from "@/db";
import { applySqliteConnectionPragmas } from "@/db/init-utils";
import { errorResponse, ErrorCodes } from "@/utils/index.js";

export type AuthenticatedUser = {
  id: number;
  username: string;
  role: "admin" | "user";
};

type AccessTokenPayload = {
  sub: string;
  username: string;
  role: "admin" | "user";
};

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
}

const DEV_SEED_USERS: Array<{
  username: string;
  password: string;
  role: "admin" | "user";
}> = [
  { username: "Tomz", password: "123456", role: "admin" },
  { username: "Dang", password: "123456", role: "user" },
];

const PASSWORD_HASH_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 64;
const LEGACY_SHA256_HEX_LENGTH = 64;

const hashLegacyPassword = (password: string) =>
  createHash("sha256").update(password).digest("hex");

const hashPassword = (password: string) => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString("hex");
  return `${PASSWORD_HASH_PREFIX}$${salt}$${derivedKey}`;
};

const isLegacySha256Hash = (value: string) =>
  /^[a-f0-9]{64}$/i.test(value) && value.length === LEGACY_SHA256_HEX_LENGTH;

const verifyPassword = (storedHash: string, password: string) => {
  if (storedHash.startsWith(`${PASSWORD_HASH_PREFIX}$`)) {
    const [, salt, derivedKeyHex] = storedHash.split("$");

    if (!salt || !derivedKeyHex) {
      return false;
    }

    const nextDerivedKeyHex = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString(
      "hex",
    );
    return isSameHash(derivedKeyHex, nextDerivedKeyHex);
  }

  if (isLegacySha256Hash(storedHash)) {
    return isSameHash(storedHash, hashLegacyPassword(password));
  }

  return false;
};

const maybeUpgradeLegacyPasswordHash = (userId: number, storedHash: string, password: string) => {
  if (!isLegacySha256Hash(storedHash)) {
    return;
  }

  userRepository.update(userId, {
    passwordHash: hashPassword(password),
  });
};

const hasUsers = () => {
  const sqlite = getSqlite();
  const row = sqlite.prepare("SELECT COUNT(1) AS count FROM users").get() as
    | { count: number }
    | undefined;
  return (row?.count ?? 0) > 0;
};

const getBootstrapUsers = () => {
  const configuredAdminUsername = process.env.SEED_ADMIN_USERNAME?.trim();
  const configuredAdminPassword = process.env.SEED_ADMIN_PASSWORD?.trim();
  const configuredUserUsername = process.env.SEED_USER_USERNAME?.trim();
  const configuredUserPassword = process.env.SEED_USER_PASSWORD?.trim();
  const allowDefaultBootstrapUsers =
    process.env.UI_CHAT_ALLOW_DEFAULT_BOOTSTRAP === "1";

  if (configuredAdminUsername && configuredAdminPassword) {
    const bootstrapUsers: Array<{
      username: string;
      password: string;
      role: "admin" | "user";
    }> = [
      {
        username: configuredAdminUsername,
        password: configuredAdminPassword,
        role: "admin",
      },
    ];

    if (configuredUserUsername && configuredUserPassword) {
      bootstrapUsers.push({
        username: configuredUserUsername,
        password: configuredUserPassword,
        role: "user",
      });
    }

    return bootstrapUsers;
  }

  if (allowDefaultBootstrapUsers) {
    console.warn(
      "[Auth] Using packaged desktop bootstrap users because UI_CHAT_ALLOW_DEFAULT_BOOTSTRAP=1.",
    );
    return DEV_SEED_USERS;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "[Auth] Using development bootstrap users. Set SEED_ADMIN_USERNAME/SEED_ADMIN_PASSWORD to override.",
    );
    return DEV_SEED_USERS;
  }

  console.warn(
    "[Auth] Users table is empty and no bootstrap credentials were configured. Login will remain unavailable until a user is created.",
  );
  return [];
};

const isSameHash = (leftHex: string, rightHex: string) => {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
};

export const initializeAuthDatabase = (): void => {
  try {
    const sqlite = getSqlite();
    applySqliteConnectionPragmas(sqlite);

    // 创建用户表
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    // 创建索引
    sqlite.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)
    `);

    if (!hasUsers()) {
      for (const seed of getBootstrapUsers()) {
        userRepository.create({
          username: seed.username,
          passwordHash: hashPassword(seed.password),
          role: seed.role,
          isActive: true,
        });
      }
    }

    console.log("✅ Auth database initialized");
  } catch (err) {
    console.error("❌ Failed to initialize auth database:", err);
    throw err;
  }
};

export const authenticateUser = (
  username: string,
  password: string,
): AuthenticatedUser | null => {
  const user = userRepository.findActiveByUsername(username);

  if (!user) {
    return null;
  }

  if (!verifyPassword(user.passwordHash, password)) {
    return null;
  }

  maybeUpgradeLegacyPasswordHash(user.id, user.passwordHash, password);

  return {
    id: user.id,
    username: user.username,
    role: user.role,
  };
};

export type ChangePasswordResult =
  | { ok: true; user: AuthenticatedUser }
  | { ok: false; reason: "USER_NOT_FOUND" | "INVALID_CURRENT_PASSWORD" | "PASSWORD_UNCHANGED" };

export const changeUserPassword = (
  userId: number,
  currentPassword: string,
  nextPassword: string,
): ChangePasswordResult => {
  const user = userRepository.findById(userId);

  if (!user || !user.isActive) {
    return { ok: false, reason: "USER_NOT_FOUND" };
  }

  if (!verifyPassword(user.passwordHash, currentPassword)) {
    return { ok: false, reason: "INVALID_CURRENT_PASSWORD" };
  }

  if (verifyPassword(user.passwordHash, nextPassword)) {
    return { ok: false, reason: "PASSWORD_UNCHANGED" };
  }

  const nextPasswordHash = hashPassword(nextPassword);

  userRepository.update(user.id, {
    passwordHash: nextPasswordHash,
  });

  return {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  };
};

const JWT_EXPIRES_IN = "7d";
let hasWarnedAboutJwtFallback = false;

const getJwtSecret = () => {
  const jwtSecret = process.env.JWT_SECRET?.trim();

  if (jwtSecret) {
    return jwtSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }

  if (!hasWarnedAboutJwtFallback) {
    hasWarnedAboutJwtFallback = true;
    console.warn("[Auth] JWT_SECRET is not set. Falling back to a development-only secret.");
  }

  return "uichat-rag-test-dev-secret";
};

export const createAccessToken = (user: AuthenticatedUser): string => {
  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role,
    },
    getJwtSecret(),
    { expiresIn: JWT_EXPIRES_IN },
  );
};

export const verifyAccessToken = (token: string): AuthenticatedUser | null => {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
    return {
      id: Number(decoded.sub),
      username: decoded.username,
      role: decoded.role,
    };
  } catch {
    return null;
  }
};

export const getAuthUserFromRequest = (
  request: FastifyRequest,
): AuthenticatedUser | null => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  return verifyAccessToken(token);
};

export const requireAuth: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const user = getAuthUserFromRequest(request);

  if (!user) {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply
        .code(401)
        .send(errorResponse("Missing auth token", ErrorCodes.UNAUTHORIZED));
    }

    return reply
      .code(401)
      .send(errorResponse("Invalid auth token", ErrorCodes.UNAUTHORIZED));
  }

  request.authUser = user;
};
