import fs from "node:fs";
import path from "node:path";
import {
  runWenshuPython,
  withWenshuTempDir,
  writeJsonFile,
} from "./python-runtime.js";

const getData = (result: {
  result: { status: string; data?: unknown; [key: string]: unknown };
}) => result.result.data ?? result.result;

export const executePdfSkillRuntime = async (input: {
  operation:
    | "create"
    | "extract_text"
    | "extract_tables"
    | "extract_images"
    | "form_info"
    | "form_fill"
    | "merge"
    | "split"
    | "rotate"
    | "crop"
    | "meta_get"
    | "meta_set"
    | "md2pdf";
  inputPath?: string;
  inputPaths?: string[];
  outputPath?: string;
  outputDir?: string;
  spec?: Record<string, unknown>;
  data?: Record<string, unknown>;
  pages?: string;
  degrees?: number;
  box?: number[];
}) =>
  await withWenshuTempDir("pdf", async (tempDir) => {
    const args = [input.operation];
    if (input.inputPath) args.push("--input", input.inputPath);
    if (input.inputPaths?.length) args.push("--inputs", ...input.inputPaths);
    if (input.outputPath) args.push("--output", input.outputPath);
    if (input.outputDir) args.push("--output-dir", input.outputDir);
    if (input.pages) args.push("--pages", input.pages);
    if (input.degrees !== undefined) args.push("--degrees", String(input.degrees));
    if (input.box?.length) args.push("--box", input.box.join(","));
    if (input.spec) {
      const specPath = path.join(tempDir, "spec.json");
      writeJsonFile(specPath, input.spec);
      args.push("--spec", specPath);
    }
    if (input.data) {
      const dataPath = path.join(tempDir, "data.json");
      writeJsonFile(dataPath, input.data);
      args.push("--data", dataPath);
    }
    const result = await runWenshuPython({
      script:
        input.operation === "create"
          ? "pdf/pdf_create_runtime.py"
          : "pdf/pdf_runtime.py",
      args,
      timeoutMs: 180_000,
    });
    return getData(result);
  });

export const executeSpreadsheetSkillRuntime = async (input: {
  operation: "create" | "modify" | "inspect" | "verify" | "recalc";
  inputPath?: string;
  outputPath?: string;
  spec?: Record<string, unknown>;
}) =>
  await withWenshuTempDir("xlsx", async (tempDir) => {
    if (input.operation === "recalc") {
      if (!input.inputPath) throw new Error("recalc requires inputPath");
      const result = await runWenshuPython({
        script: "xlsx/xlsx_tools.py",
        args: ["recalc", input.inputPath],
        timeoutMs: 180_000,
      });
      // The upstream helper may create a verification-only workbook when the
      // optional `formulas` package is installed. It must never become a user artifact.
      const verifyPath = input.inputPath.replace(/\.xlsx$/i, "_recalc_verify.xlsx");
      if (verifyPath !== input.inputPath && fs.existsSync(verifyPath)) {
        fs.rmSync(verifyPath, { recursive: true, force: true });
      }
      return getData(result);
    }

    const args = [input.operation];
    if (input.inputPath) args.push("--input", input.inputPath);
    if (input.outputPath) args.push("--output", input.outputPath);
    if (input.spec) {
      const specPath = path.join(tempDir, "spec.json");
      writeJsonFile(specPath, input.spec);
      args.push("--spec", specPath);
    }
    const result = await runWenshuPython({
      script: "xlsx/xlsx_runtime.py",
      args,
      timeoutMs: 180_000,
    });
    return getData(result);
  });

export const executePresentationSkillRuntime = async (input: {
  operation: "create" | "validate" | "inspect";
  inputPath?: string;
  outputPath?: string;
  spec?: Record<string, unknown>;
}) =>
  await withWenshuTempDir("pptx", async (tempDir) => {
    const args = [input.operation];
    if (input.inputPath) args.push("--input", input.inputPath);
    if (input.outputPath) args.push("--output", input.outputPath);
    if (input.spec) {
      const specPath = path.join(tempDir, "spec.json");
      writeJsonFile(specPath, input.spec);
      args.push("--spec", specPath);
    }
    const result = await runWenshuPython({
      script: "pptx/pptx_runtime.py",
      args,
      timeoutMs: 180_000,
    });
    return getData(result);
  });

export const readSkillArtifact = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`WenShu skill output not found: ${filePath}`);
  }
  return fs.readFileSync(filePath);
};
