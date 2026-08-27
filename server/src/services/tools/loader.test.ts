import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const root = path.resolve(process.cwd(), ".test-artifact", "p0-loader");
const builtInDir = path.join(root, "built-in");
const extendedDir = path.join(root, "extended");

vi.mock("@/config/index.js", () => ({
  default: {
    TOOLS_DIR: ".test-artifact/p0-loader/built-in",
    EXTEND_TOOLS_DIR: ".test-artifact/p0-loader/extended",
  },
}));

import { loadToolDefinitions } from "./loader.js";

const writeManifest = (baseDir: string, name: string, manifest: unknown) => {
  const toolDir = path.join(baseDir, name);
  fs.mkdirSync(toolDir, { recursive: true });
  fs.writeFileSync(path.join(toolDir, "manifest.json"), JSON.stringify(manifest), "utf8");
};

const manifest = (id: string, description: string) => ({
  id,
  name: id,
  description,
  category: "tool",
  tags: ["test"],
  runtime: { type: "filesystem", baseDir: ".test-artifact" },
});

describe("tool definition loader", () => {
  beforeAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
    writeManifest(builtInDir, "shared", manifest("shared", "built-in"));
    writeManifest(builtInDir, "builtin-only", manifest("builtin-only", "built-in only"));
    writeManifest(extendedDir, "shared", manifest("shared", "extended"));
    writeManifest(extendedDir, "invalid", { id: "invalid", runtime: { type: "shell" } });
    const malformedDir = path.join(extendedDir, "malformed");
    fs.mkdirSync(malformedDir, { recursive: true });
    fs.writeFileSync(path.join(malformedDir, "manifest.json"), "{bad-json", "utf8");
  });

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("loads valid manifests, ignores malformed ones, and lets extensions override by id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const definitions = loadToolDefinitions();

    expect(definitions.map((item) => item.id).sort()).toEqual(["builtin-only", "shared"]);
    expect(definitions.find((item) => item.id === "shared")?.description).toBe("extended");
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
