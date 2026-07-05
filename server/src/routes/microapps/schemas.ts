import {
  errorEnvelope,
  idParamsSchema,
  successEnvelope,
} from "@/routes/schema-helpers.js";

const imageGenerationJobStatusValues = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "blocked",
] as const;

const imageGenerationExecutionKindValues = [
  "sync-http",
  "async-job",
  "workflow-runner",
] as const;

const imageGenerationInputFileRoleValues = [
  "image",
  "mask",
  "reference",
] as const;

const imageGenerationArtifactSourceValues = [
  "base64",
  "remote-url",
  "local-file",
] as const;

const imageGenerationInputFileSchema = {
  type: "object",
  required: ["fileId", "role"],
  additionalProperties: false,
  properties: {
    fileId: { type: "string" },
    role: { type: "string", enum: imageGenerationInputFileRoleValues },
  },
} as const;

const imageGenerationCreateBodySchema = {
  type: "object",
  required: ["providerId"],
  additionalProperties: false,
  properties: {
    providerId: { type: "string" },
    model: { type: "string" },
    prompt: { type: "string" },
    negativePrompt: { type: "string" },
    size: { type: "string" },
    stylePreset: { type: "string" },
    count: { type: "number", minimum: 1 },
    seed: { type: "number" },
    providerParams: {
      type: "object",
      additionalProperties: true,
    },
    workflowApiJson: {
      type: "object",
      additionalProperties: true,
    },
    inputFiles: {
      type: "array",
      items: imageGenerationInputFileSchema,
    },
  },
} as const;

const imageGenerationQuerySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    refresh: {
      type: "string",
      enum: ["true", "false"],
    },
  },
} as const;

const imageGenerationArtifactSchema = {
  type: "object",
  required: ["id", "type", "mimeType", "source"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    type: { type: "string", const: "image" },
    mimeType: { type: "string" },
    source: { type: "string", enum: imageGenerationArtifactSourceValues },
    localPath: { type: "string" },
    remoteUrl: { type: "string" },
    expiresAt: { type: "string", format: "date-time" },
    width: { type: "number" },
    height: { type: "number" },
    byteSize: { type: "number" },
    fileName: { type: "string" },
    meta: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const;

const imageGenerationRequestSummarySchema = {
  type: "object",
  required: [
    "providerId",
    "providerParamKeys",
    "inputFileCount",
    "hasWorkflowApiJson",
  ],
  additionalProperties: false,
  properties: {
    providerId: { type: "string" },
    model: { type: "string" },
    prompt: { type: "string" },
    negativePrompt: { type: "string" },
    size: { type: "string" },
    stylePreset: { type: "string" },
    count: { type: "number" },
    seed: { type: "number" },
    providerParamKeys: {
      type: "array",
      items: { type: "string" },
    },
    inputFileCount: { type: "number" },
    hasWorkflowApiJson: { type: "boolean" },
  },
} as const;

const imageGenerationJobErrorSchema = {
  type: "object",
  required: ["code", "message"],
  additionalProperties: false,
  properties: {
    code: { type: "string" },
    message: { type: "string" },
    retryable: { type: "boolean" },
    details: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const;

export const imageGenerationResponseSchema = {
  type: "object",
  required: [
    "generationId",
    "status",
    "executionKind",
    "artifacts",
    "requestSummary",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    generationId: { type: "string" },
    status: { type: "string", enum: imageGenerationJobStatusValues },
    executionKind: {
      type: "string",
      enum: imageGenerationExecutionKindValues,
    },
    artifacts: {
      type: "array",
      items: imageGenerationArtifactSchema,
    },
    requestSummary: imageGenerationRequestSummarySchema,
    providerJobId: { type: "string" },
    error: imageGenerationJobErrorSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    startedAt: { type: "string", format: "date-time" },
    completedAt: { type: "string", format: "date-time" },
    meta: {
      type: "object",
      additionalProperties: true,
    },
  },
} as const;

export const imageGenerationRouteSchemas = {
  createGeneration: {
    tags: ["MicroAPP"],
    summary: "Create an image generation job",
    security: [{ bearerAuth: [] }],
    body: imageGenerationCreateBodySchema,
    response: {
      200: successEnvelope(imageGenerationResponseSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      500: errorEnvelope,
    },
  },
  getGeneration: {
    tags: ["MicroAPP"],
    summary: "Get an image generation job",
    security: [{ bearerAuth: [] }],
    params: idParamsSchema,
    querystring: imageGenerationQuerySchema,
    response: {
      200: successEnvelope(imageGenerationResponseSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
} as const;
