import { createHash, timingSafeEqual } from "node:crypto";
import { FastifyReply, FastifyRequest, preHandlerHookHandler } from "fastify";
import { open } from "sqlite";
import sqlite3 from "sqlite3";
import jwt from "jsonwebtoken";

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

type DbUserRecord = AuthenticatedUser & {
  password_hash: string;
};

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

const resolveDatabasePath = (): string => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  if (databaseUrl.startsWith("file:")) {
    return databaseUrl.slice(5);
  }

  if (databaseUrl.endsWith(".db") || databaseUrl.endsWith(".sqlite")) {
    return databaseUrl;
  }

  throw new Error("Only SQLite DATABASE_URL is supported for auth");
};

const openDatabase = async () =>
  open({
    filename: resolveDatabasePath(),
    driver: sqlite3.Database,
  });

export const initializeAuthDatabase = async () => {
  const db = await openDatabase();

  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    for (const seed of SEED_USERS) {
      await db.run(
        `
          INSERT INTO users (username, password_hash, role, is_active)
          VALUES (?, ?, ?, 1)
          ON CONFLICT(username)
          DO UPDATE SET
            password_hash = excluded.password_hash,
            role = excluded.role,
            is_active = 1`,
        seed.username,
        hashPassword(seed.password),
        seed.role,
      );
    }

    console.log("✅ Auth database initialized");
  } finally {
    await db.close();
  }
};

export const authenticateUser = async (
  username: string,
  password: string,
): Promise<AuthenticatedUser | null> => {
  const db = await openDatabase();

  try {
    const user = await db.get<DbUserRecord>(
      "SELECT * FROM users WHERE username = ? AND is_active = 1",
      username,
    );

    if (!user) {
      return null;
    }

    if (!isSameHash(user.password_hash, hashPassword(password))) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      role: user.role,
    };
  } finally {
    await db.close();
  }
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

export const requireAuth: preHandlerHookHandler = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return reply.code(401).send({ ok: false, message: "Missing auth token" });
  }

  const token = authHeader.slice(7);
  const user = verifyAccessToken(token);

  if (!user) {
    return reply.code(401).send({ ok: false, message: "Invalid auth token" });
  }

  request.authUser = user;
};
