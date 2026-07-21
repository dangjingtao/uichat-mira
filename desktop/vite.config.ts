import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import type { ViteDevServer } from "vite";

const require = createRequire(import.meta.url);
const runtimeConfig = require("../runtime.config.cjs");
const apiProxyPrefix = runtimeConfig.dev.apiProxyPrefix;
const backendOrigin = `http://${runtimeConfig.backend.host}:${runtimeConfig.backend.port}`;
const docsSiteOrigin = `http://127.0.0.1:${runtimeConfig.dev.docsSitePort}`;

const mimeTypes: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function createCoverageStaticPlugin() {
  return {
    name: "serve-coverage-report",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/client-coverage", (req, res, next) => {
        const reportDir = path.resolve(__dirname, "test-report");
        if (!fs.existsSync(reportDir)) {
          res.statusCode = 404;
          res.end("Coverage report not found");
          return;
        }

        const url = new URL(req.url || "/", "http://localhost");
        const requestedPath = decodeURIComponent(url.pathname);
        const safePath = path
          .normalize(requestedPath)
          .replace(/^(\.\.[/\\])+/, "");
        const filePath = path.join(reportDir, safePath);

        if (!filePath.startsWith(reportDir)) {
          res.statusCode = 403;
          res.end("Forbidden");
          return;
        }

        const stat = fs.statSync(filePath, { throwIfNoEntry: false });
        if (stat?.isDirectory()) {
          const indexPath = path.join(filePath, "index.html");
          if (fs.existsSync(indexPath)) {
            res.setHeader("Content-Type", "text/html; charset=utf-8");
            fs.createReadStream(indexPath).pipe(res);
            return;
          }
        } else if (stat?.isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          res.setHeader(
            "Content-Type",
            `${mimeTypes[ext] ?? "application/octet-stream"}; charset=utf-8`,
          );
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        res.statusCode = 404;
        res.end("Not found");
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    createCoverageStaticPlugin(),
    {
      name: "ignore-node-modules",
      resolveId(source) {
        if (
          source.startsWith("@ai-sdk/mcp") ||
          source.startsWith("@ai-sdk/gateway")
        ) {
          return source + "?ignore";
        }
        return null;
      },
      load(id) {
        if (id.endsWith("?ignore")) {
          return "export {};";
        }
        return null;
      },
    },
  ],
  base: "./",
  server: {
    host: "127.0.0.1",
    port: runtimeConfig.dev.desktopPort,
    strictPort: true,
    proxy: {
      [apiProxyPrefix]: {
        target: backendOrigin,
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(new RegExp(`^${apiProxyPrefix}`), ""),
      },
      "/attachments": {
        target: backendOrigin,
        changeOrigin: true,
      },
      "/artifacts": {
        target: backendOrigin,
        changeOrigin: true,
      },
      "/api-docs": {
        target: backendOrigin,
        changeOrigin: true,
      },
      "/docs": {
        target: docsSiteOrigin,
        changeOrigin: true,
      },
      "/server-coverage": {
        target: backendOrigin,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    rollupOptions: {
      external: ["child_process"],
    },
  },
});
