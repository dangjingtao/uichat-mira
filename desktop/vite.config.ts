import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

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
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
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
