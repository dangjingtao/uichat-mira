import { afterEach, describe, expect, it } from "vitest";
import { localModelRuntime } from "./index.js";

describe("localModelRuntime", () => {
  const originalRawRoot = process.env.LOCAL_MODEL_RAW_ROOT;
  const originalWasmRoot = process.env.LOCAL_ONNX_WASM_ROOT;

  afterEach(() => {
    if (originalRawRoot === undefined) {
      delete process.env.LOCAL_MODEL_RAW_ROOT;
    } else {
      process.env.LOCAL_MODEL_RAW_ROOT = originalRawRoot;
    }
    if (originalWasmRoot === undefined) {
      delete process.env.LOCAL_ONNX_WASM_ROOT;
    } else {
      process.env.LOCAL_ONNX_WASM_ROOT = originalWasmRoot;
    }
    localModelRuntime.resetForTests();
  });

  it("requires explicit model and wasm resource paths", async () => {
    delete process.env.LOCAL_MODEL_RAW_ROOT;
    delete process.env.LOCAL_ONNX_WASM_ROOT;

    await expect(localModelRuntime.embedTexts(["hello"])).rejects.toThrow(
      "LOCAL_MODEL_RAW_ROOT is not set",
    );
  });
});
