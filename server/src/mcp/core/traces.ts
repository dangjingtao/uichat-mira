import type {
  McpInvocationTrace,
  McpTraceSpan,
  McpTraceSpanKind,
} from "./definitions.js";

const traceMap = new Map<string, McpInvocationTrace>();

export const createInvocationTrace = (input: {
  invocationId: string;
  toolId: string;
  startedAt: string;
}) => {
  const trace: McpInvocationTrace = {
    traceId: crypto.randomUUID(),
    invocationId: input.invocationId,
    toolId: input.toolId,
    startedAt: input.startedAt,
    spans: [],
  };
  traceMap.set(input.invocationId, trace);
  return trace;
};

export const getInvocationTrace = (invocationId: string) => traceMap.get(invocationId);

export const clearInvocationTraces = () => {
  traceMap.clear();
};

export const finishInvocationTrace = (invocationId: string) => {
  const trace = traceMap.get(invocationId);
  if (!trace || trace.finishedAt) {
    return trace;
  }

  trace.finishedAt = new Date().toISOString();
  return trace;
};

export const startTraceSpan = (input: {
  invocationId: string;
  parentSpanId?: string;
  name: string;
  kind: McpTraceSpanKind;
  metadata?: Record<string, unknown>;
}) => {
  const trace = traceMap.get(input.invocationId);
  if (!trace) {
    throw new Error(`Trace not found for invocation ${input.invocationId}`);
  }

  const span: McpTraceSpan = {
    id: crypto.randomUUID(),
    traceId: trace.traceId,
    invocationId: input.invocationId,
    ...(input.parentSpanId ? { parentSpanId: input.parentSpanId } : {}),
    name: input.name,
    kind: input.kind,
    status: "running",
    startedAt: new Date().toISOString(),
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
  trace.spans.push(span);

  return {
    spanId: span.id,
    end: (next?: {
      status?: "completed" | "failed" | "cancelled";
      metadata?: Record<string, unknown>;
    }) => {
      if (span.finishedAt) {
        return;
      }

      span.status = next?.status ?? "completed";
      span.finishedAt = new Date().toISOString();
      if (next?.metadata) {
        span.metadata = {
          ...(span.metadata ?? {}),
          ...next.metadata,
        };
      }
    },
  };
};
