import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";
import { writeDocsIndex } from "./scripts/build-docs-index.mjs";

const require = createRequire(import.meta.url);
const runtimeConfig = require("../../runtime.config.cjs");

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
    port: runtimeConfig.dev.docsSitePort,
    strictPort: true,
  },
});
