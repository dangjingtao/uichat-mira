import path from "node:path";
import type {
  McpCapabilityMetadata,
  McpExecutionEnvironment,
  McpToolDefinition,
} from "./definitions.js";

export const describeRisk = (capabilities: McpCapabilityMetadata) => {
  if (capabilities.sideEffect === "process") {
    return "high";
  }

  if (capabilities.sideEffect === "local-write") {
    return "high";
  }

  if (capabilities.sideEffect === "network") {
    return "medium";
  }

  return "low";
};

export interface InvocationApprovalDecision {
  type: "allow" | "require_approval";
  reason?: string;
  scope?: string;
}

export interface ApprovedInvocation {
  toolId: string;
  inputHash: string;
}

const resolveWorkspaceRelativeTarget = (
  workspaceRoot: string,
  candidate: string,
) => {
  const resolved = path.resolve(workspaceRoot, candidate);
  const relative = path.relative(workspaceRoot, resolved);
  return {
    resolved,
    isOutside:
      relative.startsWith("..") || path.isAbsolute(relative),
  };
};

const getWorkspaceBoundaryCandidates = (
  definition: McpToolDefinition,
  args: Record<string, unknown>,
) => {
  const keys = definition.capabilities.workspaceBoundary?.argKeys ?? [];

  return keys
    .map((key) => {
      const value = args[key];
      return typeof value === "string" && value.trim()
        ? {
            key,
            value: value.trim(),
          }
        : null;
    })
    .filter((entry): entry is { key: string; value: string } => Boolean(entry));
};

export const evaluateInvocationApproval = (input: {
  definition: McpToolDefinition;
  args: Record<string, unknown>;
  environment?: McpExecutionEnvironment;
  approvedInvocations?: ApprovedInvocation[];
  inputHash?: string;
}): InvocationApprovalDecision => {
  // Approval remains invocation-bound. Reusing a terminal session via
  // attachSessionId does not authorize a different command unless the exact
  // new input hash was approved too.
  const isApproved =
    input.inputHash !== undefined &&
    (input.approvedInvocations?.some(
      (invocation) =>
        invocation.toolId === input.definition.id &&
        invocation.inputHash === input.inputHash,
    ) ?? false);

  if (input.definition.capabilities.workspaceBound) {
    const workspaceRoot = input.environment?.workspace.rootPath;
    const boundaryCandidates = getWorkspaceBoundaryCandidates(
      input.definition,
      input.args,
    );
    if (workspaceRoot) {
      for (const boundaryCandidate of boundaryCandidates) {
        const target = resolveWorkspaceRelativeTarget(
          workspaceRoot,
          boundaryCandidate.value,
        );
        if (target.isOutside) {
          return {
            type: "require_approval",
            reason: `${input.definition.id} requests ${boundaryCandidate.key} outside the current workspace root.`,
            scope: "workspace",
          };
        }
      }
    }
  }

  if (input.definition.capabilities.requiresApproval && !isApproved) {
    return {
      type: "require_approval",
      reason: `${input.definition.id} requires explicit approval before execution.`,
      scope: input.definition.domain,
    };
  }

  return {
    type: "allow",
  };
};

