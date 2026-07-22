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

const requireSpec = (value: unknown, field = "spec") => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw mcpBadRequest(`${field} must be an object`);
  }
  return value as Record<string, unknown>;
};

const summarize = (value: unknown) => {
  try {
    return JSON.stringify(value).slice(0, 4000);
  } catch {
    return String(value).slice(0, 4000);
  }
};

const resolveAssetPath = (value: string) => {
  if (value.startsWith("data:")) return value;
  const resolved = resolveWorkspacePath(value);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw mcpBadRequest(`Presentation asset does not exist: ${value}`);
  }
  return resolved;
};

const preparePresentationSpec = (value: Record<string, unknown>) => {
  const spec = structuredClone(value);
  const pages = Array.isArray(spec.pages) ? spec.pages : [];
  for (const pageValue of pages) {
    if (!pageValue || typeof pageValue !== "object" || Array.isArray(pageValue)) continue;
    const page = pageValue as Record<string, unknown>;
    const background = page.background;
    if (background && typeof background === "object" && !Array.isArray(background)) {
      const backgroundRecord = background as Record<string, unknown>;
      if (backgroundRecord.type === "image" && typeof backgroundRecord.src === "string") {
        backgroundRecord.src = resolveAssetPath(backgroundRecord.src);
      }
    }
    const elements = Array.isArray(page.elements) ? page.elements : [];
    for (const elementValue of elements) {
      if (!elementValue || typeof elementValue !== "object" || Array.isArray(elementValue)) continue;
      const element = elementValue as Record<string, unknown>;
      const elementType = String(element.elementType ?? element.type ?? "").toLowerCase();
      if (elementType !== "image") continue;
      const content = element.content;
      if (!content || typeof content !== "object" || Array.isArray(content)) continue;
      const contentRecord = content as Record<string, unknown>;
      for (const key of ["src", "path"] as const) {
        if (typeof contentRecord[key] === "string" && contentRecord[key]) {
          contentRecord[key] = resolveAssetPath(contentRecord[key] as string);
          break;
        }
      }
    }
  }
  return spec;
};

const assertNoBlockingValidationErrors = (validation: unknown, label = "Presentation") => {
  const record =
    validation && typeof validation === "object" && !Array.isArray(validation)
      ? (validation as Record<string, unknown>)
      : {};
  if (typeof record.errors === "number" && record.errors > 0) {
    throw mcpBadRequest(`${label} validation failed with ${record.errors} blocking issue(s)`);
  }
};

const createOne = async (input: {
  outputPath: string;
  spec: Record<string, unknown>;
}) => {
  if (!input.outputPath.toLowerCase().endsWith(".pptx")) {
    throw mcpBadRequest("outputPath must be a .pptx file");
  }
  const resolvedOutput = resolveWorkspaceWritePath(input.outputPath);
  const preparedSpec = preparePresentationSpec(input.spec);
  const validation = await executePresentationSkillRuntime({
    operation: "validate",
    spec: preparedSpec,
  });
  assertNoBlockingValidationErrors(validation, input.outputPath);
  const created = await executePresentationSkillRuntime({
    operation: "create",
    outputPath: resolvedOutput,
    spec: preparedSpec,
  });
  const inspection = await executePresentationSkillRuntime({
    operation: "inspect",
    inputPath: resolvedOutput,
  });
  return { outputPath: input.outputPath, validation, created, inspection };
};

export const officePresentationTool: McpToolImplementation = {
  definition: {
    id: "office_presentation",
    title: "Office Presentation",
    description:
      "Task-level PPTX capability used by the pptx and pptx-swarm Skills. Validate/create one structured presentation, create a batch of long/multiple presentations after all specs are ready, or inspect PPTX output. Uses a PPTD-like structured AST with editable native text/shapes/tables/charts.",
    domain: "edit",
    source: "internal",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["operation"],
      properties: {
        operation: {
          type: "string",
          enum: ["create", "create_batch", "validate", "inspect"],
        },
        inputPath: {
          type: "string",
          description: "Workspace-relative .pptx path for inspect.",
        },
        outputPath: {
          type: "string",
          description: "Workspace-relative .pptx output path for create.",
        },
        spec: {
          type: "object",
          description:
            "PPTD-like presentation AST: size [w,h], theme colors/textStyles, pages, and positioned elements. Elements: text, shape, image, icon, table, chart. Bounds are [x,y,w,h] with 1 unit = 1 point. Local image paths must be workspace-relative; data URIs are allowed.",
        },
        presentations: {
          type: "array",
          description:
            "For create_batch: all presentation specs must be supplied before execution. Each item contains outputPath and spec.",
          items: {
            type: "object",
            required: ["outputPath", "spec"],
            properties: {
              outputPath: { type: "string" },
              spec: { type: "object" },
            },
          },
        },
      },
    },
    tags: [
      "office",
      "powerpoint",
      "ppt",
      "pptx",
      "slides",
      "presentation",
      "skill",
      "swarm",
    ],
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
      const spec = preparePresentationSpec(requireSpec(context.args.spec));
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
      if (!inputPath.toLowerCase().endsWith(".pptx")) {
        throw mcpBadRequest("inputPath must be a .pptx file");
      }
      const resolvedInput = resolveWorkspacePath(inputPath);
      if (!fs.existsSync(resolvedInput) || !fs.statSync(resolvedInput).isFile()) {
        throw mcpBadRequest(`inputPath does not exist: ${inputPath}`);
      }
      const inspection = await executePresentationSkillRuntime({
        operation: "inspect",
        inputPath: resolvedInput,
      });
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

    if (operation === "create_batch") {
      if (!Array.isArray(context.args.presentations) || context.args.presentations.length === 0) {
        throw mcpBadRequest("create_batch requires a non-empty presentations array");
      }
      const entries = context.args.presentations.map((value, index) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw mcpBadRequest(`presentations[${index}] must be an object`);
        }
        const entry = value as Record<string, unknown>;
        const outputPath = requireString(entry.outputPath, `presentations[${index}].outputPath`);
        const spec = preparePresentationSpec(
          requireSpec(entry.spec, `presentations[${index}].spec`),
        );
        return { outputPath, spec };
      });

      // Swarm contract: all deck specs exist first, then validate all, then create all.
      const validations = [] as Array<{ outputPath: string; validation: unknown }>;
      for (const entry of entries) {
        const validation = await executePresentationSkillRuntime({
          operation: "validate",
          spec: entry.spec,
        });
        assertNoBlockingValidationErrors(validation, entry.outputPath);
        validations.push({ outputPath: entry.outputPath, validation });
      }

      const outputs = [] as Array<{
        outputPath: string;
        validation: unknown;
        created: unknown;
        inspection: unknown;
      }>;
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index]!;
        if (!entry.outputPath.toLowerCase().endsWith(".pptx")) {
          throw mcpBadRequest(`presentations[${index}].outputPath must be a .pptx file`);
        }
        const resolvedOutput = resolveWorkspaceWritePath(entry.outputPath);
        const created = await executePresentationSkillRuntime({
          operation: "create",
          outputPath: resolvedOutput,
          spec: entry.spec,
        });
        const inspection = await executePresentationSkillRuntime({
          operation: "inspect",
          inputPath: resolvedOutput,
        });
        const validation = validations[index]!.validation;
        outputs.push({ outputPath: entry.outputPath, validation, created, inspection });
        context.addArtifact({
          kind: "document",
          title: path.basename(entry.outputPath),
          mimeType: PPTX_MIME,
          metadata: {
            path: entry.outputPath,
            officeOperation: "create_batch",
            validation,
            inspection,
          },
        });
      }

      return {
        result: { operation, count: outputs.length, outputs },
        evidence: {
          status: "completed",
          actionTaken: `Created ${outputs.length} presentations after validating the complete batch`,
          facts: outputs.map((item) => `Output: ${item.outputPath}`),
          data: {
            kind: "office_presentation",
            operation,
            count: outputs.length,
            outputPaths: outputs.map((item) => item.outputPath),
          },
        },
      };
    }

    if (operation !== "create") {
      throw mcpBadRequest(`Unsupported office_presentation operation: ${operation}`);
    }

    const outputPath = requireString(context.args.outputPath, "outputPath");
    const result = await createOne({
      outputPath,
      spec: requireSpec(context.args.spec),
    });
    context.addArtifact({
      kind: "document",
      title: path.basename(outputPath),
      mimeType: PPTX_MIME,
      metadata: {
        path: outputPath,
        officeOperation: "create",
        validation: result.validation,
        inspection: result.inspection,
      },
    });
    return {
      result: { operation, ...result },
      evidence: {
        status: "completed",
        actionTaken: `Created presentation at ${outputPath}`,
        facts: [
          `Output: ${outputPath}`,
          `Validation: ${summarize(result.validation)}`,
          `Inspection: ${summarize(result.inspection)}`,
        ],
        data: {
          kind: "office_presentation",
          operation,
          outputPath,
          validation: result.validation,
          inspection: result.inspection,
        },
      },
    };
  },
};
