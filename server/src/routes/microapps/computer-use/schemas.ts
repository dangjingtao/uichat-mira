import {
  errorEnvelope,
  idParamsSchema,
  successEnvelope,
} from "@/routes/schema-helpers.js";

const runtimeStatusValues = [
  "ready",
  "not_installed",
  "downloading",
  "broken",
] as const;

const taskStatusValues = [
  "queued",
  "planning",
  "awaiting_approval",
  "running",
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
] as const;

const planStepStatusValues = [
  "pending",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
] as const;

const approvalStatusValues = [
  "pending",
  "approved",
  "rejected",
  "expired",
] as const;

const artifactKindValues = [
  "screenshot",
  "dom_snapshot",
  "log",
  "json",
  "download",
] as const;

const evidenceEntryKindValues = [
  "status",
  "action",
  "observation",
  "approval",
  "error",
] as const;

const resultStatusValues = [
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
] as const;

const browserEngineValues = ["chromium", "chrome", "edge"] as const;

const looseObjectSchema = {
  type: "object",
  additionalProperties: true,
} as const;

const runtimeStateSchema = {
  type: "object",
  required: ["status", "checkedAt"],
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: runtimeStatusValues },
    browserEngine: { type: "string", enum: browserEngineValues },
    version: { type: "string" },
    message: { type: "string" },
    checkedAt: { type: "string", format: "date-time" },
    details: looseObjectSchema,
  },
} as const;

const planStepSchema = {
  type: "object",
  required: [
    "id",
    "title",
    "description",
    "status",
    "requiresApproval",
  ],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    description: { type: "string" },
    status: { type: "string", enum: planStepStatusValues },
    requiresApproval: { type: "boolean" },
    approvalReason: { type: "string" },
    riskSummary: { type: "string" },
    startedAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time" },
    meta: looseObjectSchema,
  },
} as const;

const planSchema = {
  type: "object",
  required: ["steps", "summary", "createdAt", "updatedAt", "version"],
  additionalProperties: false,
  properties: {
    steps: {
      type: "array",
      items: planStepSchema,
    },
    summary: { type: "string" },
    riskSummary: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    version: { type: "number" },
  },
} as const;

const approvalSchema = {
  type: "object",
  required: ["id", "stepId", "status", "title", "reason", "requestedAt"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    stepId: { type: "string" },
    status: { type: "string", enum: approvalStatusValues },
    title: { type: "string" },
    reason: { type: "string" },
    requestedAt: { type: "string", format: "date-time" },
    resolvedAt: { type: "string", format: "date-time" },
    expiresAt: { type: "string", format: "date-time" },
    requestedBy: { type: "string" },
    resolvedBy: { type: "string" },
    resolutionNote: { type: "string" },
    meta: looseObjectSchema,
  },
} as const;

const artifactSchema = {
  type: "object",
  required: ["id", "kind", "label", "createdAt"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: artifactKindValues },
    label: { type: "string" },
    mimeType: { type: "string" },
    filePath: { type: "string" },
    url: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    byteSize: { type: "number" },
    meta: looseObjectSchema,
  },
} as const;

const evidenceEntrySchema = {
  type: "object",
  required: ["id", "kind", "message", "createdAt"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: evidenceEntryKindValues },
    message: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    stepId: { type: "string" },
    artifactIds: {
      type: "array",
      items: { type: "string" },
    },
    meta: looseObjectSchema,
  },
} as const;

const evidenceSchema = {
  type: "object",
  required: ["entries", "artifacts"],
  additionalProperties: false,
  properties: {
    entries: {
      type: "array",
      items: evidenceEntrySchema,
    },
    artifacts: {
      type: "array",
      items: artifactSchema,
    },
    lastUpdatedAt: { type: "string", format: "date-time" },
  },
} as const;

const taskErrorSchema = {
  type: "object",
  required: ["code", "message"],
  additionalProperties: false,
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    retryable: { type: "boolean" },
    details: looseObjectSchema,
  },
} as const;

const resultSchema = {
  type: "object",
  required: ["status", "summary", "completedAt"],
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: resultStatusValues },
    summary: { type: "string" },
    completedAt: { type: "string", format: "date-time" },
    finalUrl: { type: "string" },
    outputText: { type: "string" },
    error: taskErrorSchema,
    meta: looseObjectSchema,
  },
} as const;

export const computerUseTaskResponseSchema = {
  type: "object",
  required: [
    "taskId",
    "goal",
    "siteScope",
    "status",
    "runtime",
    "approvals",
    "evidence",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    taskId: { type: "string" },
    goal: { type: "string" },
    siteScope: {
      type: "array",
      items: { type: "string" },
    },
    requestedBy: { type: "string" },
    status: { type: "string", enum: taskStatusValues },
    runtime: runtimeStateSchema,
    plan: planSchema,
    pendingApproval: approvalSchema,
    approvals: {
      type: "array",
      items: approvalSchema,
    },
    evidence: evidenceSchema,
    result: resultSchema,
    currentStepId: { type: "string" },
    meta: looseObjectSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    startedAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time" },
  },
} as const;

const createTaskBodySchema = {
  type: "object",
  required: ["goal"],
  additionalProperties: false,
  properties: {
    goal: { type: "string", minLength: 1 },
    siteScope: {
      type: "array",
      items: { type: "string" },
    },
    requestedBy: { type: "string" },
    meta: looseObjectSchema,
    autoStart: { type: "boolean" },
  },
} as const;

const resolveApprovalBodySchema = {
  type: "object",
  required: ["approvalId", "decision"],
  additionalProperties: false,
  properties: {
    approvalId: { type: "string" },
    decision: {
      type: "string",
      enum: ["approved", "rejected"],
    },
    resolvedBy: { type: "string" },
    resolutionNote: { type: "string" },
  },
} as const;

const cancelTaskBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reason: { type: "string" },
  },
} as const;

const installRuntimeBodySchema = {
  type: "object",
  required: ["version", "archiveUrl", "executableRelativePath"],
  additionalProperties: false,
  properties: {
    version: { type: "string" },
    archiveUrl: { type: "string", minLength: 1 },
    executableRelativePath: { type: "string", minLength: 1 },
    expectedSha256: { type: "string" },
  },
} as const;

export const computerUseRouteSchemas = {
  getRuntime: {
    tags: ["MicroAPP"],
    summary: "Get computer use runtime state",
    security: [{ bearerAuth: [] }],
    response: {
      200: successEnvelope(runtimeStateSchema),
      401: errorEnvelope,
      500: errorEnvelope,
    },
  },
  installRuntime: {
    tags: ["MicroAPP"],
    summary: "Install managed computer use browser runtime",
    security: [{ bearerAuth: [] }],
    body: installRuntimeBodySchema,
    response: {
      200: successEnvelope(runtimeStateSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      500: errorEnvelope,
    },
  },
  createTask: {
    tags: ["MicroAPP"],
    summary: "Create a computer use task",
    security: [{ bearerAuth: [] }],
    body: createTaskBodySchema,
    response: {
      200: successEnvelope(computerUseTaskResponseSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      404: errorEnvelope,
      409: errorEnvelope,
      500: errorEnvelope,
    },
  },
  getTask: {
    tags: ["MicroAPP"],
    summary: "Get a computer use task",
    security: [{ bearerAuth: [] }],
    params: idParamsSchema,
    response: {
      200: successEnvelope(computerUseTaskResponseSchema),
      401: errorEnvelope,
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  startTask: {
    tags: ["MicroAPP"],
    summary: "Start a planned computer use task",
    security: [{ bearerAuth: [] }],
    params: idParamsSchema,
    response: {
      200: successEnvelope(computerUseTaskResponseSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      404: errorEnvelope,
      409: errorEnvelope,
      500: errorEnvelope,
    },
  },
  resolveApproval: {
    tags: ["MicroAPP"],
    summary: "Resolve a computer use approval request",
    security: [{ bearerAuth: [] }],
    params: idParamsSchema,
    body: resolveApprovalBodySchema,
    response: {
      200: successEnvelope(computerUseTaskResponseSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      404: errorEnvelope,
      409: errorEnvelope,
      500: errorEnvelope,
    },
  },
  cancelTask: {
    tags: ["MicroAPP"],
    summary: "Cancel a computer use task",
    security: [{ bearerAuth: [] }],
    params: idParamsSchema,
    body: cancelTaskBodySchema,
    response: {
      200: successEnvelope(computerUseTaskResponseSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
} as const;
