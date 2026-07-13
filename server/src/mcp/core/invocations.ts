import { createArtifact } from "./artifacts.js";
import type {
  McpArtifact,
  McpExecutionEnvironment,
  McpInvocationFailureCode,
  McpInvocationRecord,
  McpStreamEvent,
  McpStreamEventInput,
  McpToolExecutionResult,
} from "./definitions.js";
import { withEventMeta } from "./events.js";
import { McpApprovalRequiredError, mcpBadRequest, mcpNotFound } from "./errors.js";
import { getToolImplementation } from "./registry.js";
import {
  clearInvocationTraces,
  configureInvocationTraceRetention,
  createInvocationTrace,
  finishInvocationTrace,
  getInvocationTrace,
  startTraceSpan,
  sweepInvocationTraces,
} from "./traces.js";
import {
  DEFAULT_RETENTION_CONFIG,
  sweepRetentionMap,
  type RetentionConfig,
} from "@/utils/retention.js";
import { isAppError } from "@/utils/errors.js";
import { ErrorCodes } from "@/utils/response.js";
import { evaluateInvocationApproval } from "./permissions.js";
import { createInvocationInputHash } from "@/agent/approval-fingerprint.js";
import { validateInvocationArgs } from "./schema.js";
import { redactExternalMcpValue } from "../external-redaction.js";

const invocationMap = new Map<string, McpInvocationRecord>();
const invocationEvents = new Map<string, McpStreamEvent[]>();
let invocationRetentionConfig: RetentionConfig = {
  ...DEFAULT_RETENTION_CONFIG,
};

const appendEvent = (invocationId: string, event: McpStreamEvent) => {
  const events = invocationEvents.get(invocationId) ?? [];
  events.push(event);
  invocationEvents.set(invocationId, events);
};

const sweepInvocations = () => {
  sweepRetentionMap(invocationMap, {
    config: invocationRetentionConfig,
    getUpdatedAt: (record) => record.finishedAt ?? record.startedAt,
    keep: (record) => !record.finishedAt,
  });
  sweepRetentionMap(invocationEvents, {
    config: invocationRetentionConfig,
    getUpdatedAt: (_events) => undefined,
  });
  sweepInvocationTraces();
};

export const getInvocation = (invocationId: string) =>
  invocationMap.get(invocationId);

export const listInvocationEvents = (invocationId: string) =>
  invocationEvents.get(invocationId) ?? [];

export const clearInvocations = () => {
  invocationMap.clear();
  invocationEvents.clear();
  clearInvocationTraces();
};

export const configureInvocationRetention = (
  config: Partial<RetentionConfig>,
) => {
  invocationRetentionConfig = {
    ...invocationRetentionConfig,
    ...config,
  };
  configureInvocationTraceRetention(config);
};

export const sweepStoredInvocations = () => {
  sweepInvocations();
};

export const getInvocationTraceRecord = (invocationId: string) => getInvocationTrace(invocationId);

export interface ExecuteInvocationInput {
  toolId: string;
  args?: Record<string, unknown>;
  userId?: number;
  threadId?: string;
  turnId?: string;
  signal?: AbortSignal;
  environment?: McpExecutionEnvironment;
  approvedInvocations?: Array<{
    toolId: string;
    inputHash: string;
  }>;
  onEvent?: (event: McpStreamEvent) => void | Promise<void>;
}

export const executeInvocation = async (
  input: ExecuteInvocationInput,
): Promise<McpInvocationRecord> => {
  const tool = getToolImplementation(input.toolId);
  if (!tool) {
    throw mcpNotFound(`Tool not found: ${input.toolId}`);
  }

  const args = input.args ?? {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw mcpBadRequest("Invocation args must be an object");
  }
  validateInvocationArgs(args, tool.definition.inputSchema);
  const inputHash = createInvocationInputHash(args);

  const invocationId = crypto.randomUUID();
  sweepInvocations();
  const startedAt = new Date().toISOString();
  const artifacts: McpArtifact[] = [];
  const signal = input.signal ?? new AbortController().signal;
  const trace = createInvocationTrace({
    invocationId,
    toolId: input.toolId,
    startedAt,
  });

  const record: McpInvocationRecord = {
    id: invocationId,
    toolId: input.toolId,
    status: "running",
    args: tool.definition.source === "external"
      ? redactExternalMcpValue(args) as Record<string, unknown>
      : args,
    artifacts,
    traceId: trace.traceId,
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(input.turnId ? { turnId: input.turnId } : {}),
    startedAt,
  };
  invocationMap.set(invocationId, record);

  const emit = async (event: McpStreamEventInput) => {
    const safeEvent = tool.definition.source === "external"
      ? redactExternalMcpValue(event) as McpStreamEventInput
      : event;
    const full = withEventMeta(invocationId, safeEvent);
    appendEvent(invocationId, full);
    await input.onEvent?.(full);
  };

  await emit({
    type: "invocation:start",
    toolId: input.toolId,
  });

  const invocationSpan = startTraceSpan({
    invocationId,
    name: `Invoke ${input.toolId}`,
    kind: "invocation",
    metadata: {
      toolId: input.toolId,
    },
  });

  try {
    const approvalDecision = evaluateInvocationApproval({
      definition: tool.definition,
      args,
      environment: input.environment,
      approvedInvocations: input.approvedInvocations,
      inputHash,
    });
    if (approvalDecision.type === "require_approval") {
      throw new McpApprovalRequiredError(
        approvalDecision.reason ?? `${input.toolId} requires approval.`,
        {
          scope: approvalDecision.scope,
        },
      );
    }

    const response = (await tool.execute({
      invocationId,
      args,
      userId: input.userId,
      threadId: input.threadId,
      turnId: input.turnId,
      signal,
      environment: input.environment,
      pushEvent: (event) => {
        void emit(event);
      },
      addArtifact: (artifact) => {
        const artifactSpan = startTraceSpan({
          invocationId,
          parentSpanId: invocationSpan.spanId,
          name: `Emit artifact ${artifact.kind}`,
          kind: "artifact_emit",
          metadata: {
            kind: artifact.kind,
            title: artifact.title,
          },
        });
        const next = createArtifact(artifact);
        const safeArtifact = tool.definition.source === "external"
          ? redactExternalMcpValue(next) as typeof next
          : next;
        artifacts.push(safeArtifact);
        void emit({
          type: "invocation:artifact",
          artifact: safeArtifact,
        });
        artifactSpan.end({
          metadata: {
            artifactId: safeArtifact.id,
          },
        });
        return next;
      },
      trace: {
        startSpan: (spanInput) =>
          startTraceSpan({
            invocationId,
            ...spanInput,
            ...(tool.definition.source === "external" && spanInput.metadata
              ? { metadata: redactExternalMcpValue(spanInput.metadata) as Record<string, unknown> }
              : {}),
          }),
      },
    })) as McpToolExecutionResult;

    if (response.result !== undefined) {
      const resultSpan = startTraceSpan({
        invocationId,
        parentSpanId: invocationSpan.spanId,
        name: "Normalize result",
        kind: "result_normalization",
      });
      record.result = tool.definition.source === "external"
        ? redactExternalMcpValue(response.result)
        : response.result;
      await emit({
        type: "invocation:result",
        result: record.result,
      });
      resultSpan.end();
    }

    record.status = signal.aborted ? "cancelled" : "completed";
    record.finishedAt = new Date().toISOString();
    invocationSpan.end({
      status: signal.aborted ? "cancelled" : "completed",
      metadata: {
        status: record.status,
      },
    });
    finishInvocationTrace(invocationId);

    await emit({
      type: "invocation:finish",
      status: record.status,
    });
    sweepInvocations();

    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = tool.definition.source === "external"
      ? String(redactExternalMcpValue(message))
      : message;
    if (error instanceof McpApprovalRequiredError) {
      record.status = "awaiting_approval";
      record.approval = {
        required: true,
        reason: message,
        ...(error.scope ? { scope: error.scope } : {}),
      };
      record.finishedAt = new Date().toISOString();
      invocationSpan.end({
        status: "completed",
        metadata: {
          status: record.status,
          approvalScope: error.scope,
        },
      });
      finishInvocationTrace(invocationId);

      await emit({
        type: "invocation:approval_required",
        message,
        ...(error.scope ? { scope: error.scope } : {}),
      });
      await emit({
        type: "invocation:finish",
        status: record.status,
      });
      sweepInvocations();

      return record;
    }

    const failureCode = inferInvocationFailureCode({
      error,
      message: safeMessage,
      signal,
    });
    record.status = signal.aborted ? "cancelled" : "failed";
    record.error = {
      message,
      failureCode,
    };
    record.finishedAt = new Date().toISOString();
    invocationSpan.end({
      status: signal.aborted ? "cancelled" : "failed",
      metadata: {
        status: record.status,
        message: safeMessage,
        failureCode,
      },
    });
    finishInvocationTrace(invocationId);

    await emit({
      type: "invocation:error",
      message: safeMessage,
    });
    await emit({
      type: "invocation:finish",
      status: record.status,
    });
    sweepInvocations();

    return record;
  }
};

const inferInvocationFailureCode = (input: {
  error: unknown;
  message: string;
  signal: AbortSignal;
}): McpInvocationFailureCode => {
  if (input.signal.aborted) {
    return "cancelled";
  }

  if (isAppError(input.error)) {
    if (
      input.error.statusCode === 400 ||
      input.error.code === ErrorCodes.VALIDATION_ERROR
    ) {
      return "schema_invalid";
    }

    if (
      input.error.statusCode === 403 ||
      input.error.code === ErrorCodes.FORBIDDEN
    ) {
      return "policy_denied";
    }
  }

  if (/\bapproval mismatch\b/i.test(input.message)) {
    return "approval_mismatch";
  }

  if (/\bpolicy denied\b/i.test(input.message)) {
    return "policy_denied";
  }

  if (
    /\boutside workspace\b/i.test(input.message) ||
    /\boutside the current workspace root\b/i.test(input.message)
  ) {
    return "workspace_escape";
  }

  if (/\bschema\b/i.test(input.message)) {
    return "schema_invalid";
  }

  if (/\btimeout\b|\btimed out\b/i.test(input.message)) {
    return "timeout";
  }

  return "tool_runtime_failed";
};
