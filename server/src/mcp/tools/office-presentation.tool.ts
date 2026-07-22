import fs from "node:fs";
import path from "node:path";
import type { McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest } from "../core/errors.js";
import { resolveWorkspacePath, resolveWorkspaceWritePath } from "../workspace.js";
import { executePresentationSkillRuntime } from "@/microapps/office-suite/skill-runtime.js";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const requireString = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw mcpBadRequest(`${field} is required`);
  return value.trim();
};
const requireSpec = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw mcpBadRequest("spec must be an object");
  return value as Record<string, unknown>;
};
const summarize = (value: unknown) => {
  try { return JSON.stringify(value).slice(0, 4000); } catch { return String(value).slice(0, 4000); }
};

export const officePresentationTool: McpToolImplementation = {
  definition: {
    id: "office_presentation",
    title: "Office Presentation",
    description:
      "Task-level PPTX capability used by the pptx Skill. Build a presentation from a PPTD-like structured AST with themes, positioned text, shapes, images, editable tables/charts and icons; validate overflow/bounds/occlusion before creation; inspect generated or existing PPTX files.",
    domain: "edit",
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["operation"],
      properties: {
        operation: { type: "string", enum: ["create", "validate", "inspect"] },
        inputPath: { type: "string", description: "Workspace-relative .pptx path for inspect." },
        outputPath: { type: "string", description: "Workspace-relative .pptx output path for create." },
        spec: {
          type: "object",
          description:
            "PPTD-like presentation AST: size [w,h], theme colors/textStyles, pages, and positioned elements. Elements: text, shape, image, icon, table, chart. Bounds are [x,y,w,h] with 1 unit = 1 point.",
        },
      },
    },
    tags: ["office", "powerpoint", "ppt", "pptx", "slides", "presentation", "skill"],
    capabilities: {
      sideEffect: "local-write",
      requiresApproval: true,
      workspaceBound: true,
      workspaceBoundary: { argKeys: ["inputPath", "outputPath"] },
    },
  },
  execute: async (context) => {
    const operation = requireString(context.args.operation, "operation");
    if (operation === "validate") {
      const spec = requireSpec(context.args.spec);
      const validation = await executePresentationSkillRuntime({ operation: "validate", spec });
      return {
        result: { operation, validation },
        evidence: {
          status: "completed",
          actionTaken: "Validated presentation specification",
          facts: [`Validation: ${summarize(validation)}`],
          data: { kind: "office_presentation", operation, validation },
        },
      };
    }
    if (operation === "inspect") {
      const inputPath = requireString(context.args.inputPath, "inputPath");
      if (!inputPath.toLowerCase().endsWith(".pptx")) throw mcpBadRequest("inputPath must be a .pptx file");
      const resolvedInput = resolveWorkspacePath(inputPath);
      if (!fs.existsSync(resolvedInput) || !fs.statSync(resolvedInput).isFile()) throw mcpBadRequest(`inputPath does not exist: ${inputPath}`);
      const inspection = await executePresentationSkillRuntime({ operation: "inspect", inputPath: resolvedInput });
      return {
        result: { operation, inputPath, inspection },
        evidence: {
          status: "completed",
          actionTaken: `Inspected presentation ${inputPath}`,
          facts: [`Source: ${inputPath}`, `Inspection: ${summarize(inspection)}`],
          data: { kind: "office_presentation", operation, inputPath, inspection },
        },
      };
    }
    if (operation !== "create") throw mcpBadRequest(`Unsupported office_presentation operation: ${operation}`);
    const outputPath = requireString(context.args.outputPath, "outputPath");
    if (!outputPath.toLowerCase().endsWith(".pptx")) throw mcpBadRequest("outputPath must be a .pptx file");
    const resolvedOutput = resolveWorkspaceWritePath(outputPath);
    const spec = requireSpec(context.args.spec);
    const validation = await executePresentationSkillRuntime({ operation: "validate", spec });
    const validationObject = validation && typeof validation === "object" && !Array.isArray(validation)
      ? validation as Record<string, unknown>
      : {};
    if (typeof validationObject.errors === "number" && validationObject.errors > 0) {
      throw mcpBadRequest(`Presentation validation failed with ${validationObject.errors} blocking issue(s)`);
    }
    const created = await executePresentationSkillRuntime({ operation: "create", outputPath: resolvedOutput, spec });
    const inspection = await executePresentationSkillRuntime({ operation: "inspect", inputPath: resolvedOutput });
    context.addArtifact({
      kind: "document",
      title: path.basename(outputPath),
      mimeType: PPTX_MIME,
      metadata: { path: outputPath, officeOperation: "create", validation, inspection },
    });
    return {
      result: { operation, outputPath, validation, created, inspection },
      evidence: {
        status: "completed",
        actionTaken: `Created presentation at ${outputPath}`,
        facts: [
          `Output: ${outputPath}`,
          `Validation: ${summarize(validation)}`,
          `Inspection: ${summarize(inspection)}`,
        ],
        data: { kind: "office_presentation", operation, outputPath, validation, inspection },
      },
    };
  },
};
