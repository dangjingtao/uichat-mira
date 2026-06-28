import { createArtifact } from "./artifacts.js";
import type {
  McpArtifact,
  McpExecutionEnvironment,
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
  createInvocationTrace,
  finishInvocationTrace,
  getInvocationTrace,
  startTraceSpan,
} from "./traces.js";

const invocationMap = new Map<string, McpInvocationRecord>();
const invocationEvents = new Map<string, McpStreamEvent[]>();

const appendEvent = (invocationId: string, event: McpStreamEvent) => {
  const events = invocationEvents.get(invocationId) ?? [];
  events.push(event);
  invocationEvents.set(invocationId, events);
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

export const getInvocationTraceRecord = (invocationId: string) => getInvocationTrace(invocationId);

export interface ExecuteInvocationInput {
  toolId: string;
  args?: Record<string, unknown>;
  userId?: number;
  threadId?: string;
  turnId?: string;
  signal?: AbortSignal;
  environment?: McpExecutionEnvironment;
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

  const invocationId = crypto.randomUUID();
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
    args,
    artifacts,
    traceId: trace.traceId,
    ...(input.threadId ? { threadId: input.threadId } : {}),
    ...(input.turnId ? { turnId: input.turnId } : {}),
    startedAt,
  };
  invocationMap.set(invocationId, record);

  const emit = async (event: McpStreamEventInput) => {
    const full = withEventMeta(invocationId, event);
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
        artifacts.push(next);
        void emit({
          type: "invocation:artifact",
          artifact: next,
        });
        artifactSpan.end({
          metadata: {
            artifactId: next.id,
          },
        });
        return next;
      },
      trace: {
        startSpan: (spanInput) =>
          startTraceSpan({
            invocationId,
            ...spanInput,
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
      record.result = response.result;
      await emit({
        type: "invocation:result",
        result: response.result,
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

    return record;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
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

      return record;
    }

    record.status = signal.aborted ? "cancelled" : "failed";
    record.error = { message };
    record.finishedAt = new Date().toISOString();
    invocationSpan.end({
      status: signal.aborted ? "cancelled" : "failed",
      metadata: {
        status: record.status,
        message,
      },
    });
    finishInvocationTrace(invocationId);

    await emit({
      type: "invocation:error",
      message,
    });
    await emit({
      type: "invocation:finish",
      status: record.status,
    });

    return record;
  }
};
