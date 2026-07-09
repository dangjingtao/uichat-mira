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
const comfyUiConnectionStatusValues = [
  "unconfigured",
  "unverified",
  "connectable",
  "failed",
] as const;
const comfyUiFlowSourceValues = ["template", "upload", "manual"] as const;

const imageGenerationInputFileSchema = {
  type: "object",
  required: ["fileId", "role"],
  additionalProperties: false,
  properties: {
    fileId: { type: "string" },
    role: { type: "string", enum: imageGenerationInputFileRoleValues },
  },
} as const;

const comfyUiNodeMappingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    promptPath: { type: "string" },
    seedPath: { type: "string" },
    widthPath: { type: "string" },
    heightPath: { type: "string" },
    outputNodeId: { type: "string" },
    previewNodeId: { type: "string" },
  },
} as const;

const comfyUiConnectionBodySchema = {
  type: "object",
  required: ["baseUrl"],
  additionalProperties: false,
  properties: {
    baseUrl: { type: "string" },
    clientId: { type: "string" },
  },
} as const;

const comfyUiFlowBodySchema = {
  type: "object",
  required: ["name", "workflowApiJson"],
  additionalProperties: false,
  properties: {
    connectionId: { anyOf: [{ type: "string" }, { type: "null" }] },
    name: { type: "string" },
    note: { type: "string" },
    source: { type: "string", enum: comfyUiFlowSourceValues },
    workflowApiJson: { type: "string" },
    mapping: comfyUiNodeMappingSchema,
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
    publicUrl: { type: "string" },
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

const imageGenerationArtifactParamsSchema = {
  type: "object",
  required: ["id", "artifactId"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    artifactId: { type: "string" },
  },
} as const;

const imageGenerationProgressSchema = {
  type: "object",
  required: [
    "generationId",
    "status",
    "stage",
    "progressPercent",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    generationId: { type: "string" },
    providerJobId: { type: "string" },
    status: { type: "string", enum: imageGenerationJobStatusValues },
    stage: { type: "string" },
    progressPercent: { type: "number" },
    message: { type: "string" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const comfyUiConnectionSchema = {
  type: "object",
  required: ["id", "baseUrl", "clientId", "status", "createdAt", "updatedAt"],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    baseUrl: { type: "string" },
    clientId: { type: "string" },
    status: { type: "string", enum: comfyUiConnectionStatusValues },
    lastError: {
      anyOf: [
        {
          type: "object",
          required: ["code", "message"],
          additionalProperties: true,
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            details: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
        { type: "null" },
      ],
    },
    lastCheckedAt: {
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const comfyUiFlowSchema = {
  type: "object",
  required: [
    "id",
    "connectionId",
    "name",
    "note",
    "source",
    "workflowApiJson",
    "mapping",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    connectionId: { anyOf: [{ type: "string" }, { type: "null" }] },
    name: { type: "string" },
    note: { type: "string" },
    source: { type: "string", enum: comfyUiFlowSourceValues },
    workflowApiJson: { type: "string" },
    mapping: comfyUiNodeMappingSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
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
  listComfyUiConnections: {
    tags: ["MicroAPP"],
    summary: "List ComfyUI connections",
    security: [{ bearerAuth: [] }],
    response: {
      200: successEnvelope({
        type: "array",
        items: comfyUiConnectionSchema,
      }),
      401: errorEnvelope,
      500: errorEnvelope,
    },
  },
  createComfyUiConnection: {
    tags: ["MicroAPP"],
    summary: "Create ComfyUI connection",
    security: [{ bearerAuth: [] }],
    body: comfyUiConnectionBodySchema,
    response: {
      200: successEnvelope(comfyUiConnectionSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      500: errorEnvelope,
    },
  },
  updateComfyUiConnection: {
    tags: ["MicroAPP"],
    summary: "Update ComfyUI connection",
    security: [{ bearerAuth: [] }],
    params: idParamsSchema,
    body: comfyUiConnectionBodySchema,
    response: {
      200: successEnvelope(comfyUiConnectionSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  testComfyUiConnection: {
    tags: ["MicroAPP"],
    summary: "Test ComfyUI connection",
    security: [{ bearerAuth: [] }],
    params: idParamsSchema,
    response: {
      200: successEnvelope(comfyUiConnectionSchema),
      401: errorEnvelope,
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  listComfyUiFlows: {
    tags: ["MicroAPP"],
    summary: "List ComfyUI flows",
    security: [{ bearerAuth: [] }],
    response: {
      200: successEnvelope({
        type: "array",
        items: comfyUiFlowSchema,
      }),
      401: errorEnvelope,
      500: errorEnvelope,
    },
  },
  createComfyUiFlow: {
    tags: ["MicroAPP"],
    summary: "Create ComfyUI flow",
    security: [{ bearerAuth: [] }],
    body: comfyUiFlowBodySchema,
    response: {
      200: successEnvelope(comfyUiFlowSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      500: errorEnvelope,
    },
  },
  updateComfyUiFlow: {
    tags: ["MicroAPP"],
    summary: "Update ComfyUI flow",
    security: [{ bearerAuth: [] }],
    params: idParamsSchema,
    body: comfyUiFlowBodySchema,
    response: {
      200: successEnvelope(comfyUiFlowSchema),
      400: errorEnvelope,
      401: errorEnvelope,
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
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
  getGenerationArtifactContent: {
    tags: ["MicroAPP"],
    summary: "Get image generation artifact content",
    security: [{ bearerAuth: [] }],
    params: imageGenerationArtifactParamsSchema,
    response: {
      200: {
        description: "Binary image artifact content",
        type: "string",
        format: "binary",
      },
      401: errorEnvelope,
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  getGenerationProgress: {
    tags: ["MicroAPP"],
    summary: "Get image generation job progress",
    security: [{ bearerAuth: [] }],
    params: idParamsSchema,
    response: {
      200: successEnvelope(imageGenerationProgressSchema),
      401: errorEnvelope,
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
} as const;
