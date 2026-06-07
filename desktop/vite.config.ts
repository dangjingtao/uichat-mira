import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const runtimeConfig = require("../runtime.config.cjs");
const apiProxyPrefix = runtimeConfig.dev.apiProxyPrefix;
const backendOrigin = `http://${runtimeConfig.backend.host}:${runtimeConfig.backend.port}`;

export default defineConfig({
  plugins: [
    react(),
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
    port: 5173,
    strictPort: true,
    proxy: {
      [apiProxyPrefix]: {
        target: backendOrigin,
        changeOrigin: true,
        rewrite: (path) => path.replace(new RegExp(`^${apiProxyPrefix}`), ""),
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
