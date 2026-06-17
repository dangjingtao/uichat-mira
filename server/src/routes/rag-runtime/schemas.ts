const nodeRecordSchema = {
  type: "object",
  required: ["nodeId", "nodeType", "label", "status"],
  properties: {
    nodeId: { type: "string" },
    nodeType: { type: "string" },
    label: { type: "string" },
    status: {
      type: "string",
      enum: ["running", "completed", "failed"],
    },
    startedAt: { type: "string", format: "date-time" },
    finishedAt: { type: "string", format: "date-time" },
    durationMs: { type: "number" },
    summary: { type: "string" },
    details: {
      type: "object",
      additionalProperties: true,
    },
    artifacts: {
      type: "object",
      additionalProperties: true,
    },
    environment: {
      type: "object",
      additionalProperties: true,
    },
    error: {
      type: "object",
      properties: {
        type: { type: "string" },
        message: { type: "string" },
      },
      required: ["message"],
    },
  },
} as const;

export const ragRunRecordSchema = {
  type: "object",
  required: ["runId", "route", "status", "startedAt", "nodes"],
  properties: {
    runId: { type: "string" },
    route: {
      type: "string",
      enum: ["run", "retrieve", "stream"],
    },
    status: {
      type: "string",
      enum: ["running", "completed", "failed"],
    },
    startedAt: { type: "string", format: "date-time" },
    finishedAt: { type: "string", format: "date-time" },
    durationMs: { type: "number" },
    input: {
      type: "object",
      additionalProperties: true,
    },
    output: {
      type: "object",
      additionalProperties: true,
    },
    error: {
      type: "object",
      properties: {
        type: { type: "string" },
        message: { type: "string" },
      },
      required: ["message"],
    },
    nodes: {
      type: "array",
      items: nodeRecordSchema,
    },
  },
} as const;
