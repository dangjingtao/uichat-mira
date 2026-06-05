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
            is_active = 1
        `,
        seed.username,
        hashPassword(seed.password),
        seed.role,
      );
    }
  } finally {
    await db.close();
  }
};

export const verifyUserCredentials = async (
  username: string,
  password: string,
): Promise<AuthenticatedUser | null> => {
  const db = await openDatabase();

  try {
    const user = await db.get<DbUserRecord>(
      `
        SELECT id, username, role, password_hash
        FROM users
        WHERE username = ? AND is_active = 1
      `,
      username,
    );

    if (!user) {
      return null;
    }

    const expectedHash = hashPassword(password);

    if (!isSameHash(user.password_hash, expectedHash)) {
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

export const issueAccessToken = (user: AuthenticatedUser) => {
  const jwtSecret = process.env.JWT_SECRET ?? "rag-demo-dev-secret";

  return jwt.sign(
    {
      sub: String(user.id),
      username: user.username,
      role: user.role,
    },
    jwtSecret,
    {
      expiresIn: "8h",
      issuer: "ui-chat-rag-tester-server",
    },
  );
};

const sendUnauthorized = (reply: FastifyReply, message: string) =>
  reply.code(401).send({
    ok: false,
    message,
  });

export const verifyAccessToken = (token: string): AuthenticatedUser | null => {
  const jwtSecret = process.env.JWT_SECRET ?? "rag-demo-dev-secret";

  try {
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: "ui-chat-rag-tester-server",
    }) as jwt.JwtPayload & AccessTokenPayload;

    const userId = Number(decoded.sub);

    if (
      !Number.isInteger(userId) ||
      !decoded.username ||
      (decoded.role !== "admin" && decoded.role !== "user")
    ) {
      return null;
    }

    return {
      id: userId,
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
  const rawAuthorization = request.headers.authorization;

  if (!rawAuthorization) {
    return sendUnauthorized(reply, "Missing Authorization header");
  }

  const [scheme, token] = rawAuthorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return sendUnauthorized(reply, "Invalid Authorization header format");
  }

  const authUser = verifyAccessToken(token);

  if (!authUser) {
    return sendUnauthorized(reply, "Token is invalid or expired");
  }

  request.authUser = authUser;
};
