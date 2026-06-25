import type { McpArtifact, McpArtifactKind } from "./definitions.js";

export const createArtifact = (input: {
  kind: McpArtifactKind;
  title: string;
  mimeType?: string;
  data?: unknown;
  uri?: string;
  metadata?: Record<string, unknown>;
}): McpArtifact => ({
  id: crypto.randomUUID(),
  kind: input.kind,
  title: input.title,
  ...(input.mimeType ? { mimeType: input.mimeType } : {}),
  ...(input.data !== undefined ? { data: input.data } : {}),
  ...(input.uri ? { uri: input.uri } : {}),
  ...(input.metadata ? { metadata: input.metadata } : {}),
});

