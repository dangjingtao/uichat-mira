import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  executePdfSkillRuntime,
  executePresentationSkillRuntime,
  executeSpreadsheetSkillRuntime,
} from "@/microapps/office-suite/skill-runtime.js";
import { probeWenshuPythonRuntime } from "@/microapps/office-suite/python-runtime.js";
import { success } from "@/utils/index.js";
import { badRequest, routeHandler } from "@/utils/route-errors.js";

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 20;

type UploadedPart = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

type SkillTaskPayload = Record<string, unknown> & { operation?: unknown };

const parseTaskJson = (value: unknown): SkillTaskPayload => {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("task must be a JSON object");
    }
    return parsed as SkillTaskPayload;
  } catch (error) {
    throw badRequest(error instanceof Error ? `task JSON 无效: ${error.message}` : "task JSON 无效");
  }
};

const readMultipartTask = async (request: FastifyRequest) => {
  const files: UploadedPart[] = [];
  let task: SkillTaskPayload = {};
  for await (const part of request.parts({
    limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES },
  })) {
    if (part.type === "file") {
      const buffer = await part.toBuffer();
      if (buffer.byteLength > 0) {
        files.push({ fileName: part.filename, mimeType: part.mimetype, buffer });
      }
      continue;
    }
    if (part.fieldname === "task") {
      task = parseTaskJson(part.value);
    }
  }
  return { task, files };
};

const operationOf = (task: SkillTaskPayload) => {
  if (typeof task.operation !== "string" || !task.operation.trim()) {
    throw badRequest("task.operation is required");
  }
  return task.operation.trim();
};

const objectValue = (value: unknown, field: string, optional = false) => {
  if (value === undefined && optional) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
};

const stringValue = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const withTemp = async <T>(prefix: string, run: (dir: string) => Promise<T>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mira-wenshu-workbench-${prefix}-`));
  try {
    return await run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

const writeUploads = (dir: string, files: UploadedPart[]) =>
  files.map((file, index) => {
    const safeName = path.basename(file.fileName || `upload-${index + 1}`);
    const filePath = path.join(dir, `${String(index + 1).padStart(2, "0")}-${safeName}`);
    fs.writeFileSync(filePath, file.buffer);
    return { ...file, filePath };
  });

const sendDownload = (
  reply: FastifyReply,
  filePath: string,
  fileName: string,
  mimeType: string,
) => {
  reply.header("Cache-Control", "no-store");
  reply.header("Content-Disposition", `attachment; filename="${fileName.replace(/["\r\n]/g, "_")}"`);
  reply.type(mimeType);
  return reply.send(fs.readFileSync(filePath));
};

const sendDirectoryZip = (
  reply: FastifyReply,
  directory: string,
  fileName: string,
) => {
  const zip = new AdmZip();
  if (fs.existsSync(directory)) zip.addLocalFolder(directory);
  reply.header("Cache-Control", "no-store");
  reply.header("Content-Disposition", `attachment; filename="${fileName}"`);
  reply.type("application/zip");
  return reply.send(zip.toBuffer());
};

const runPdfWorkbenchTask = async (
  reply: FastifyReply,
  task: SkillTaskPayload,
  files: UploadedPart[],
) =>
  await withTemp("pdf", async (dir) => {
    const operation = operationOf(task);
    const uploads = writeUploads(dir, files);
    const first = uploads[0]?.filePath;
    const output = path.join(dir, stringValue(task.outputName) || "wenshu-output.pdf");

    if (operation === "create") {
      const result = await executePdfSkillRuntime({ operation, outputPath: output, spec: objectValue(task.spec, "task.spec")! });
      return sendDownload(reply, output, path.basename(output), "application/pdf");
    }
    if (operation === "md2pdf") {
      if (!first) throw badRequest("md2pdf requires one Markdown upload");
      await executePdfSkillRuntime({ operation, inputPath: first, outputPath: output });
      return sendDownload(reply, output, path.basename(output), "application/pdf");
    }
    if (operation === "merge") {
      if (uploads.length < 2) throw badRequest("merge requires at least two PDF uploads");
      await executePdfSkillRuntime({ operation, inputPaths: uploads.map((item) => item.filePath), outputPath: output });
      return sendDownload(reply, output, path.basename(output), "application/pdf");
    }
    if (!first) throw badRequest(`${operation} requires an uploaded PDF`);
    if (["extract_text", "extract_tables", "form_info", "meta_get"].includes(operation)) {
      const result = await executePdfSkillRuntime({
        operation: operation as "extract_text" | "extract_tables" | "form_info" | "meta_get",
        inputPath: first,
        pages: stringValue(task.pages),
      });
      return success({ operation, result }, "PDF skill task completed");
    }
    if (operation === "extract_images" || operation === "split") {
      const outputDir = path.join(dir, "outputs");
      await executePdfSkillRuntime({ operation, inputPath: first, outputDir });
      return sendDirectoryZip(reply, outputDir, `wenshu-${operation}.zip`);
    }
    if (operation === "form_fill") {
      await executePdfSkillRuntime({ operation, inputPath: first, outputPath: output, data: objectValue(task.data, "task.data")! });
    } else if (operation === "rotate") {
      if (!Number.isInteger(task.degrees)) throw badRequest("task.degrees must be an integer");
      await executePdfSkillRuntime({ operation, inputPath: first, outputPath: output, degrees: task.degrees as number, pages: stringValue(task.pages) });
    } else if (operation === "crop") {
      if (!Array.isArray(task.box) || task.box.length !== 4 || task.box.some((item) => typeof item !== "number")) {
        throw badRequest("task.box must be [x0,y0,x1,y1]");
      }
      await executePdfSkillRuntime({ operation, inputPath: first, outputPath: output, box: task.box as number[], pages: stringValue(task.pages) });
    } else if (operation === "meta_set") {
      await executePdfSkillRuntime({ operation, inputPath: first, outputPath: output, data: objectValue(task.data, "task.data")! });
    } else {
      throw badRequest(`Unsupported PDF operation: ${operation}`);
    }
    return sendDownload(reply, output, path.basename(output), "application/pdf");
  });

const runSpreadsheetWorkbenchTask = async (
  reply: FastifyReply,
  task: SkillTaskPayload,
  files: UploadedPart[],
) =>
  await withTemp("xlsx", async (dir) => {
    const operation = operationOf(task);
    const uploads = writeUploads(dir, files);
    const first = uploads[0]?.filePath;
    const output = path.join(dir, stringValue(task.outputName) || "wenshu-output.xlsx");
    if (operation === "create") {
      await executeSpreadsheetSkillRuntime({ operation, outputPath: output, spec: objectValue(task.spec, "task.spec")! });
      await executeSpreadsheetSkillRuntime({ operation: "recalc", inputPath: output });
      await executeSpreadsheetSkillRuntime({ operation: "verify", inputPath: output });
      return sendDownload(reply, output, path.basename(output), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }
    if (!first) throw badRequest(`${operation} requires an uploaded .xlsx`);
    if (operation === "inspect" || operation === "verify") {
      const result = await executeSpreadsheetSkillRuntime({ operation, inputPath: first });
      return success({ operation, result }, "Spreadsheet skill task completed");
    }
    if (operation === "modify") {
      await executeSpreadsheetSkillRuntime({ operation, inputPath: first, outputPath: output, spec: objectValue(task.spec, "task.spec")! });
      await executeSpreadsheetSkillRuntime({ operation: "recalc", inputPath: output });
      await executeSpreadsheetSkillRuntime({ operation: "verify", inputPath: output });
      return sendDownload(reply, output, path.basename(output), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }
    if (operation === "recalc") {
      fs.copyFileSync(first, output);
      await executeSpreadsheetSkillRuntime({ operation, inputPath: output });
      return sendDownload(reply, output, path.basename(output), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }
    throw badRequest(`Unsupported spreadsheet operation: ${operation}`);
  });

const runPresentationWorkbenchTask = async (
  reply: FastifyReply,
  task: SkillTaskPayload,
  files: UploadedPart[],
) =>
  await withTemp("pptx", async (dir) => {
    const operation = operationOf(task);
    const uploads = writeUploads(dir, files);
    if (operation === "validate") {
      const validation = await executePresentationSkillRuntime({ operation, spec: objectValue(task.spec, "task.spec")! });
      return success({ operation, validation }, "Presentation specification validated");
    }
    if (operation === "inspect") {
      const first = uploads[0]?.filePath;
      if (!first) throw badRequest("inspect requires an uploaded .pptx");
      const inspection = await executePresentationSkillRuntime({ operation, inputPath: first });
      return success({ operation, inspection }, "Presentation inspected");
    }
    if (operation !== "create") throw badRequest(`Unsupported presentation operation: ${operation}`);
    const spec = objectValue(task.spec, "task.spec")!;
    const validation = await executePresentationSkillRuntime({ operation: "validate", spec });
    const validationRecord = validation && typeof validation === "object" && !Array.isArray(validation)
      ? validation as Record<string, unknown>
      : {};
    if (typeof validationRecord.errors === "number" && validationRecord.errors > 0) {
      throw badRequest(`PPT validation has ${validationRecord.errors} blocking issue(s)`);
    }
    const output = path.join(dir, stringValue(task.outputName) || "wenshu-output.pptx");
    await executePresentationSkillRuntime({ operation, outputPath: output, spec });
    return sendDownload(reply, output, path.basename(output), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  });

export const registerOfficeSkillWorkbenchRoutes = async (app: FastifyInstance) => {
  app.get(
    "/microapps/office-suite/runtime/status",
    routeHandler("Failed to inspect WenShu runtime", async () => {
      const runtimes = await probeWenshuPythonRuntime();
      return success({ runtimes }, "WenShu Python runtime status");
    }),
  );

  app.post<{ Querystring: { domain?: string } }>(
    "/microapps/office-suite/skill-task",
    routeHandler<{ Querystring: { domain?: string } }>("Failed to execute WenShu skill task", async (request, reply) => {
      const domain = request.query.domain?.trim().toLowerCase();
      const { task, files } = await readMultipartTask(request);
      if (domain === "pdf") return runPdfWorkbenchTask(reply, task, files);
      if (domain === "xlsx") return runSpreadsheetWorkbenchTask(reply, task, files);
      if (domain === "pptx") return runPresentationWorkbenchTask(reply, task, files);
      throw badRequest("domain must be pdf, xlsx, or pptx");
    }),
  );
};
