import { FastifyPluginAsync } from "fastify";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";

const tryTcpConnect = (host: string, port: number, timeoutMs = 1500) =>
  new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port });

    const done = (result: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });

const dbHealthRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/db/health",
    {
      schema: {
        tags: ["System"],
        summary: "Database connectivity health check",
        response: {
          200: {
            type: "object",
            required: ["ok", "configured", "mode", "detail", "now"],
            properties: {
              ok: { type: "boolean" },
              configured: { type: "boolean" },
              mode: { type: "string" },
              detail: { type: "string" },
              now: { type: "string", format: "date-time" },
            },
          },
        },
      },
    },
    async () => {
      const databaseUrl = process.env.DATABASE_URL;

      if (!databaseUrl) {
        return {
          ok: false,
          configured: false,
          mode: "unconfigured",
          detail: "DATABASE_URL 未配置（服务启动后会默认使用本地 SQLite）",
          now: new Date().toISOString(),
        };
      }

      if (databaseUrl.startsWith("file:")) {
        const filePath = databaseUrl.replace("file:", "");

        try {
          await fs.access(filePath);
          return {
            ok: true,
            configured: true,
            mode: "sqlite",
            detail: `SQLite 文件可访问: ${filePath}`,
            now: new Date().toISOString(),
          };
        } catch {
          return {
            ok: false,
            configured: true,
            mode: "sqlite",
            detail: `SQLite 文件不可访问: ${filePath}`,
            now: new Date().toISOString(),
          };
        }
      }

      if (databaseUrl.endsWith(".db") || databaseUrl.endsWith(".sqlite")) {
        const dbPath = path.resolve(databaseUrl);

        try {
          await fs.access(dbPath);
          return {
            ok: true,
            configured: true,
            mode: "sqlite",
            detail: `SQLite 文件可访问: ${dbPath}`,
            now: new Date().toISOString(),
          };
        } catch {
          return {
            ok: false,
            configured: true,
            mode: "sqlite",
            detail: `SQLite 文件不可访问: ${dbPath}`,
            now: new Date().toISOString(),
          };
        }
      }

      try {
        const parsed = new URL(databaseUrl);
        const host = parsed.hostname;

        if (!host) {
          throw new Error("缺少主机名");
        }

        let port = Number(parsed.port);
        if (!port) {
          if (parsed.protocol.startsWith("postgres")) {
            port = 5432;
          } else if (parsed.protocol.startsWith("mysql")) {
            port = 3306;
          } else {
            port = 0;
          }
        }

        if (!port) {
          return {
            ok: false,
            configured: true,
            mode: parsed.protocol.replace(":", ""),
            detail: `无法推断端口: ${databaseUrl}`,
            now: new Date().toISOString(),
          };
        }

        const reachable = await tryTcpConnect(host, port);

        return {
          ok: reachable,
          configured: true,
          mode: parsed.protocol.replace(":", ""),
          detail: reachable
            ? `数据库地址可连接: ${host}:${port}`
            : `数据库地址不可达: ${host}:${port}`,
          now: new Date().toISOString(),
        };
      } catch (error) {
        return {
          ok: false,
          configured: true,
          mode: "unknown",
          detail:
            error instanceof Error
              ? `数据库 URL 解析失败: ${error.message}`
              : "数据库 URL 解析失败",
          now: new Date().toISOString(),
        };
      }
    },
  );
};

export default dbHealthRoute;
