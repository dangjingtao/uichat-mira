import type {
  McpInvocationRecord,
  McpInvocationTrace,
  McpStreamEvent,
} from "../core/definitions.js";
import {
  clearInvocations,
  executeInvocation,
  getInvocation,
  getInvocationTraceRecord,
  listInvocationEvents,
  type ExecuteInvocationInput,
} from "../core/invocations.js";
import { getHarnessEnvironmentSnapshot } from "./environment.js";

export const executeHarnessInvocation = (
  input: ExecuteInvocationInput,
): Promise<McpInvocationRecord> =>
  executeInvocation({
    ...input,
    environment: input.environment ?? getHarnessEnvironmentSnapshot(),
  });

export const getHarnessInvocation = (invocationId: string) =>
  getInvocation(invocationId);

export const listHarnessInvocationEvents = (
  invocationId: string,
): McpStreamEvent[] => listInvocationEvents(invocationId);

export const getHarnessInvocationTrace = (
  invocationId: string,
): McpInvocationTrace | undefined => getInvocationTraceRecord(invocationId);

export const clearHarnessInvocations = () => clearInvocations();
