import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { writeDocsIndex } from "./scripts/build-docs-index.mjs";

function docsIndexAutoBuildPlugin() {
  let hasGeneratedForServe = false;

  return {
    name: "docs-index-auto-build",
    buildStart() {
      writeDocsIndex();
    },
    configureServer() {
      if (!hasGeneratedForServe) {
        writeDocsIndex();
        hasGeneratedForServe = true;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), docsIndexAutoBuildPlugin()],
  base: "/docs/",
  server: {
    host: "127.0.0.1",
    port: 4180,
    strictPort: true,
  },
});
