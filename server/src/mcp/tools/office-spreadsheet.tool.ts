import fs from "node:fs";
import path from "node:path";
import type { McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest } from "../core/errors.js";
import { resolveWorkspacePath, resolveWorkspaceWritePath } from "../workspace.js";
import { executeSpreadsheetSkillRuntime } from "@/microapps/office-suite/skill-runtime.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw mcpBadRequest(`${field} is required`);
  return value.trim();
};
const optionalString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const requireSpec = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw mcpBadRequest("spec must be an object");
  return value as Record<string, unknown>;
};
const defaultOutputPath = (inputPath: string, suffix = "wenshu") => {
  const extension = path.extname(inputPath);
  return `${inputPath.slice(0, -extension.length)}-${suffix}.xlsx`;
};
const summaryPreview = (value: unknown) => {
  try { return JSON.stringify(value).slice(0, 4000); } catch { return String(value).slice(0, 4000); }
};
const resolveExistingWorkbook = (value: unknown) => {
  const inputPath = requireString(value, "inputPath");
  if (!inputPath.toLowerCase().endsWith(".xlsx")) throw mcpBadRequest("inputPath must be a .xlsx file");
  const resolved = resolveWorkspacePath(inputPath);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) throw mcpBadRequest(`inputPath does not exist: ${inputPath}`);
  return { inputPath, resolved };
};

export const officeSpreadsheetTool: McpToolImplementation = {
  definition: {
    id: "office_spreadsheet",
    title: "Office Spreadsheet",
    description:
      "Task-level XLSX capability used by the xlsx Skill. Create, modify, inspect, recalculate and verify formula-linked styled workbooks with sheets, formulas, charts, conditional formatting, named ranges, comments, hyperlinks and source citations.",
    domain: "edit",
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["operation"],
      properties: {
        operation: { type: "string", enum: ["create", "modify", "inspect", "recalc", "verify"] },
        inputPath: { type: "string", description: "Workspace-relative existing .xlsx path." },
        outputPath: { type: "string", description: "Workspace-relative .xlsx output path." },
        spec: {
          type: "object",
          description:
            "High-level workbook specification. Supports metadata, sheets, rows/cells, Excel formulas, styles, dimensions, merges, charts, conditional formats, named ranges, comments, hyperlinks, and Sources entries.",
        },
      },
    },
    tags: ["office", "excel", "xlsx", "spreadsheet", "finance", "skill"],
    capabilities: {
      sideEffect: "local-write",
      requiresApproval: true,
      workspaceBound: true,
      workspaceBoundary: { argKeys: ["inputPath", "outputPath"] },
    },
  },
  execute: async (context) => {
    const operation = requireString(context.args.operation, "operation");

    if (operation === "inspect" || operation === "verify") {
      const { inputPath, resolved } = resolveExistingWorkbook(context.args.inputPath);
      const result = await executeSpreadsheetSkillRuntime({ operation, inputPath: resolved });
      return {
        result: { operation, inputPath, data: result },
        evidence: {
          status: "completed",
          actionTaken: `${operation === "inspect" ? "Inspected" : "Verified"} spreadsheet ${inputPath}`,
          facts: [`Source: ${inputPath}`, `Result: ${summaryPreview(result)}`],
          data: { kind: "office_spreadsheet", operation, inputPath, result },
        },
      };
    }

    if (operation === "create") {
      const outputPath = requireString(context.args.outputPath, "outputPath");
      if (!outputPath.toLowerCase().endsWith(".xlsx")) throw mcpBadRequest("outputPath must be a .xlsx file");
      const resolvedOutput = resolveWorkspaceWritePath(outputPath);
      const spec = requireSpec(context.args.spec);
      const created = await executeSpreadsheetSkillRuntime({ operation: "create", outputPath: resolvedOutput, spec });
      const recalculation = await executeSpreadsheetSkillRuntime({ operation: "recalc", inputPath: resolvedOutput });
      const verification = await executeSpreadsheetSkillRuntime({ operation: "verify", inputPath: resolvedOutput });
      context.addArtifact({
        kind: "table", title: path.basename(outputPath), mimeType: XLSX_MIME,
        metadata: { path: outputPath, officeOperation: "create", recalculation, verification },
      });
      return {
        result: { operation, outputPath, created, recalculation, verification },
        evidence: {
          status: "completed",
          actionTaken: `Created spreadsheet at ${outputPath}`,
          facts: [`Output: ${outputPath}`, `Recalculation: ${summaryPreview(recalculation)}`, `Verification: ${summaryPreview(verification)}`],
          data: { kind: "office_spreadsheet", operation, outputPath, verification },
        },
      };
    }

    if (operation === "modify") {
      const { inputPath, resolved } = resolveExistingWorkbook(context.args.inputPath);
      const outputPath = optionalString(context.args.outputPath) ?? defaultOutputPath(inputPath);
      if (!outputPath.toLowerCase().endsWith(".xlsx")) throw mcpBadRequest("outputPath must be a .xlsx file");
      const resolvedOutput = resolveWorkspaceWritePath(outputPath);
      if (path.resolve(resolved) === path.resolve(resolvedOutput)) throw mcpBadRequest("outputPath must not overwrite the source workbook");
      const spec = requireSpec(context.args.spec);
      const modified = await executeSpreadsheetSkillRuntime({ operation: "modify", inputPath: resolved, outputPath: resolvedOutput, spec });
      const recalculation = await executeSpreadsheetSkillRuntime({ operation: "recalc", inputPath: resolvedOutput });
      const verification = await executeSpreadsheetSkillRuntime({ operation: "verify", inputPath: resolvedOutput });
      context.addArtifact({
        kind: "table", title: path.basename(outputPath), mimeType: XLSX_MIME,
        metadata: { sourcePath: inputPath, path: outputPath, officeOperation: "modify", recalculation, verification },
      });
      return {
        result: { operation, inputPath, outputPath, modified, recalculation, verification },
        evidence: {
          status: "completed",
          actionTaken: `Modified spreadsheet ${inputPath} and wrote ${outputPath}`,
          facts: [`Source: ${inputPath}`, `Output: ${outputPath}`, `Verification: ${summaryPreview(verification)}`],
          data: { kind: "office_spreadsheet", operation, inputPath, outputPath, verification },
        },
      };
    }

    if (operation === "recalc") {
      const { inputPath, resolved } = resolveExistingWorkbook(context.args.inputPath);
      const outputPath = optionalString(context.args.outputPath) ?? defaultOutputPath(inputPath, "recalculated");
      if (!outputPath.toLowerCase().endsWith(".xlsx")) throw mcpBadRequest("outputPath must be a .xlsx file");
      const resolvedOutput = resolveWorkspaceWritePath(outputPath);
      if (path.resolve(resolved) === path.resolve(resolvedOutput)) throw mcpBadRequest("outputPath must not overwrite the source workbook");
      fs.copyFileSync(resolved, resolvedOutput);
      const recalculation = await executeSpreadsheetSkillRuntime({ operation: "recalc", inputPath: resolvedOutput });
      const verification = await executeSpreadsheetSkillRuntime({ operation: "verify", inputPath: resolvedOutput });
      context.addArtifact({
        kind: "table", title: path.basename(outputPath), mimeType: XLSX_MIME,
        metadata: { sourcePath: inputPath, path: outputPath, officeOperation: "recalc", recalculation, verification },
      });
      return {
        result: { operation, inputPath, outputPath, recalculation, verification },
        evidence: {
          status: "completed",
          actionTaken: `Prepared recalculated workbook ${outputPath}`,
          facts: [`Source: ${inputPath}`, `Output: ${outputPath}`, `Recalculation: ${summaryPreview(recalculation)}`],
          data: { kind: "office_spreadsheet", operation, inputPath, outputPath, verification },
        },
      };
    }

    throw mcpBadRequest(`Unsupported office_spreadsheet operation: ${operation}`);
  },
};
