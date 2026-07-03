import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyWorkspaceEnvBootstrap,
  findWorkspaceRoot,
} from "./bootstrap-env.js";

const touchedEnvKeys = ["LOCAL_MODEL_RAW_ROOT", "LOCAL_ONNX_WASM_ROOT"];

afterEach(() => {
  for (const key of touchedEnvKeys) {
    delete process.env[key];
  }
});

describe("bootstrap-env", () => {
  it("finds the workspace root by walking up to a sentinel file", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bootstrap-env-"));
    const nestedDir = path.join(tempRoot, "packages", "server");
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(path.join(tempRoot, "runtime.config.cjs"), "module.exports = {};\n");

    expect(findWorkspaceRoot(nestedDir)).toBe(tempRoot);
  });

  it("loads root .env values into process.env", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bootstrap-env-"));
    const nestedDir = path.join(tempRoot, "server");
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(
      path.join(tempRoot, ".env"),
      [
        "LOCAL_MODEL_RAW_ROOT=D:\\models\\raw",
        "LOCAL_ONNX_WASM_ROOT=D:\\runtime\\onnx",
      ].join("\n"),
    );

    applyWorkspaceEnvBootstrap(nestedDir);

    expect(process.env.LOCAL_MODEL_RAW_ROOT).toBe("D:\\models\\raw");
    expect(process.env.LOCAL_ONNX_WASM_ROOT).toBe("D:\\runtime\\onnx");
  });
});
