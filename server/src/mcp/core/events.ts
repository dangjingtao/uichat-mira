import type { McpStreamEvent, McpStreamEventInput } from "./definitions.js";

export const withEventMeta = (
  invocationId: string,
  event: McpStreamEventInput,
): McpStreamEvent => ({
  ...event,
  invocationId,
  at: new Date().toISOString(),
} as McpStreamEvent);

export const toSseChunk = (event: McpStreamEvent) =>
  `data: ${JSON.stringify(event)}\n\n`;
