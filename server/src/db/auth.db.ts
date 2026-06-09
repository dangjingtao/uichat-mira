/**
 * 认证模块
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import jwt from "jsonwebtoken";
import { getSqlite, userRepository } from "@/db";

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

const SEED_USERS: Array<{
  username: string;
  password: string;
  role: "admin" | "user";
}> = [
  { username: "Tomz", password: "123456", role: "admin" },
  { username: "Dang", password: "123456", role: "user" },
];

const hashPassword = (password: string) =>
  createHash("sha256").update(password).digest("hex");

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

    // 插入或更新种子用户
    for (const seed of SEED_USERS) {
      const existing = userRepository.findByUsername(seed.username);
      if (existing) {
        userRepository.update(existing.id, {
          passwordHash: hashPassword(seed.password),
          role: seed.role,
          isActive: true,
        });
      } else {
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

  if (!isSameHash(user.passwordHash, hashPassword(password))) {
    return null;
  }

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

  const currentPasswordHash = hashPassword(currentPassword);
  const nextPasswordHash = hashPassword(nextPassword);

  if (!isSameHash(user.passwordHash, currentPasswordHash)) {
    return { ok: false, reason: "INVALID_CURRENT_PASSWORD" };
  }

  if (isSameHash(user.passwordHash, nextPasswordHash)) {
    return { ok: false, reason: "PASSWORD_UNCHANGED" };
  }

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

const JWT_SECRET =
  process.env.JWT_SECRET || "uichat-rag-test-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

export const createAccessToken = (user: AuthenticatedUser): string => {
  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
};

export const verifyAccessToken = (token: string): AuthenticatedUser | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AccessTokenPayload;
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
      return reply.code(401).send({ ok: false, message: "Missing auth token" });
    }

    return reply.code(401).send({ ok: false, message: "Invalid auth token" });
  }

  request.authUser = user;
};
