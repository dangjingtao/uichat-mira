import crypto from "node:crypto";
import { createInvocationInputHash } from "@/agent/approval-fingerprint.js";
import { getHarnessEnvironmentSnapshot } from "@/harness/environment.js";
import { executeHarnessInvocation } from "@/harness/invocations.js";
import { getCapabilityImplementation } from "@/harness/registry.js";
import type { McpArtifact, McpToolImplementation } from "@/mcp/core/definitions.js";
import { officeDocumentTool } from "@/mcp/tools/office-document.tool.js";
import { officePdfTool } from "@/mcp/tools/office-pdf.tool.js";
import { officePresentationTool } from "@/mcp/tools/office-presentation.tool.js";
import { officeSpreadsheetTool } from "@/mcp/tools/office-spreadsheet.tool.js";
import { runWithWorkspaceRootOverride } from "@/mcp/workspace.js";
import type {
  SkillAgentApprovedInvocation,
  SkillAgentExecutionInput,
  SkillAgentRequirement,
  SkillAgentToolBinding,
} from "./types.js";

const PRIVATE_WENSHU_RUNTIME_TOOLS = new Map<string, McpToolImplementation>([
  [officeDocumentTool.definition.id, officeDocumentTool],
  [officePdfTool.definition.id, officePdfTool],
  [officePresentationTool.definition.id, officePresentationTool],
  [officeSpreadsheetTool.definition.id, officeSpreadsheetTool],
]);

const hasExactApproval = (
  toolId: string,
  inputHash: string,
  approvedInvocations: SkillAgentApprovedInvocation[] | undefined,
) =>
  Boolean(
    approvedInvocations?.some(
      (approval) => approval.toolId === toolId && approval.inputHash === inputHash,
    ),
  );

const approvalRequirement = (
  toolId: string,
  inputHash: string,
  args: Record<string, unknown>,
): SkillAgentRequirement => ({
  id: `approval:${toolId}:${inputHash}`,
  kind: "approval",
  description: `${toolId} requires approval for this exact invocation before the forked Skill agent may continue.`,
  requiredFor: toolId,
  toolId,
  input: structuredClone(args),
  inputHash,
});

const toModelPayload = (value: unknown) => {
  try {
    const serialized = JSON.stringify(value);
    return serialized.length <= 24_000 ? serialized : `${serialized.slice(0, 24_000)}…`;
  } catch {
    return String(value).slice(0, 24_000);
  }
};

export const createHarnessSkillAgentToolBinding = (input: {
  toolId: string;
  execution: SkillAgentExecutionInput;
}): SkillAgentToolBinding => {
  const implementation = getCapabilityImplementation(input.toolId);
  if (!implementation) {
    throw new Error(`Skill Agent Harness tool is unavailable: ${input.toolId}`);
  }
  const definition = implementation.definition;

  return {
    id: definition.id,
    label: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    execute: async (args, signal) => {
      const record = await runWithWorkspaceRootOverride(
        input.execution.workspaceRoot,
        async () =>
          await executeHarnessInvocation({
            toolId: definition.id,
            args,
            userId: input.execution.userId,
            threadId: input.execution.threadId,
            turnId: input.execution.turnId,
            signal,
            environment: getHarnessEnvironmentSnapshot(),
            approvedInvocations: input.execution.approvedInvocations,
          }),
      );

      if (record.status === "awaiting_approval") {
        const inputHash = createInvocationInputHash(args);
        return {
          result: {
            status: "needs_approval",
            toolId: definition.id,
            inputHash,
            message: record.approval?.reason ?? `${definition.id} requires approval.`,
          },
          evidence: record.evidence,
          artifacts: record.artifacts,
          terminate: true,
          requirement: approvalRequirement(definition.id, inputHash, args),
        };
      }

      if (record.status !== "completed") {
        throw new Error(
          record.error?.message ?? `${definition.id} ended with status ${record.status}`,
        );
      }

      return {
        result: record.result,
        evidence: record.evidence,
        artifacts: record.artifacts,
      };
    },
  };
};

export const createPrivateWenShuRuntimeToolBinding = (input: {
  runtimeId: string;
  execution: SkillAgentExecutionInput;
}): SkillAgentToolBinding => {
  const implementation = PRIVATE_WENSHU_RUNTIME_TOOLS.get(input.runtimeId);
  if (!implementation) {
    throw new Error(`Unknown private WenShu runtime adapter: ${input.runtimeId}`);
  }
  const definition = implementation.definition;

  return {
    id: definition.id,
    label: definition.title,
    description: `${definition.description} This adapter is private to the active Skill agent and is not a global Harness tool.`,
    inputSchema: definition.inputSchema,
    execute: async (args, signal) => {
      const inputHash = createInvocationInputHash(args);
      const approvalGranted = hasExactApproval(
        definition.id,
        inputHash,
        input.execution.approvedInvocations,
      );

      if (definition.capabilities.requiresApproval && !approvalGranted) {
        return {
          result: {
            status: "needs_approval",
            toolId: definition.id,
            inputHash,
          },
          terminate: true,
          requirement: approvalRequirement(definition.id, inputHash, args),
        };
      }

      const artifacts: McpArtifact[] = [];
      const response = await runWithWorkspaceRootOverride(
        input.execution.workspaceRoot,
        async () =>
          await implementation.execute({
            invocationId: crypto.randomUUID(),
            args,
            userId: input.execution.userId,
            approval: { inputHash, granted: approvalGranted },
            threadId: input.execution.threadId,
            turnId: input.execution.turnId,
            signal: signal ?? new AbortController().signal,
            environment: getHarnessEnvironmentSnapshot(),
            pushEvent: () => undefined,
            addArtifact: (artifact) => {
              const next: McpArtifact = { id: crypto.randomUUID(), ...artifact };
              artifacts.push(next);
              return next;
            },
            trace: {
              startSpan: () => ({
                spanId: crypto.randomUUID(),
                end: () => undefined,
              }),
            },
          }),
      );

      return {
        result: response.result,
        evidence: response.evidence,
        artifacts,
      };
    },
  };
};

export const renderSkillAgentToolResult = (input: {
  result?: unknown;
  evidence?: unknown;
  artifacts?: unknown[];
  requirement?: SkillAgentRequirement;
}) =>
  toModelPayload({
    result: input.result ?? null,
    evidence: input.evidence ?? null,
    artifacts: input.artifacts ?? [],
    requirement: input.requirement ?? null,
  });
