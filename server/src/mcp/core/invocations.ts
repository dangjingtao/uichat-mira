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
};

export interface ExecuteInvocationInput {
  toolId: string;
  args?: Record<string, unknown>;
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

  const record: McpInvocationRecord = {
    id: invocationId,
    toolId: input.toolId,
    status: "running",
    args,
    artifacts,
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

  try {
    const response = (await tool.execute({
      invocationId,
      args,
      signal,
      environment: input.environment,
      pushEvent: (event) => {
        void emit(event);
      },
      addArtifact: (artifact) => {
        const next = createArtifact(artifact);
        artifacts.push(next);
        void emit({
          type: "invocation:artifact",
          artifact: next,
        });
        return next;
      },
    })) as McpToolExecutionResult;

    if (response.result !== undefined) {
      record.result = response.result;
      await emit({
        type: "invocation:result",
        result: response.result,
      });
    }

    record.status = signal.aborted ? "cancelled" : "completed";
    record.finishedAt = new Date().toISOString();

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
