import { ROLE_STATUS_VALUES } from "@/constants/domain.js";
import {
  deletedResponseSchema,
  errorEnvelope,
  idParamsSchema,
  successEnvelope,
} from "@/routes/schema-helpers.js";

const rolePromptSchema = {
  type: "object",
  required: [
    "description",
    "worldview",
    "persona",
    "scenario",
    "exampleDialogues",
    "style",
    "constraints",
  ],
  additionalProperties: false,
  properties: {
    description: { type: "string" },
    worldview: { type: "string" },
    persona: { type: "string" },
    scenario: { type: "string" },
    exampleDialogues: { type: "string" },
    style: { type: "string" },
    constraints: { type: "string" },
  },
} as const;

const roleLlmProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    temperature: { type: "number" },
    topP: { type: "number" },
    topK: { type: "number" },
    maxTokens: { type: "number" },
    frequencyPenalty: { type: "number" },
    presencePenalty: { type: "number" },
  },
} as const;

export const roleSchema = {
  type: "object",
  required: [
    "id",
    "name",
    "summary",
    "avatarId",
    "status",
    "tags",
    "prompt",
    "llmProfile",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    summary: { type: "string" },
    avatarId: { type: ["string", "null"] },
    status: { type: "string", enum: ROLE_STATUS_VALUES },
    tags: {
      type: "array",
      items: { type: "string" },
    },
    prompt: rolePromptSchema,
    llmProfile: roleLlmProfileSchema,
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
  },
} as const;

const roleMutationBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string" },
    summary: { type: "string" },
    avatarId: { type: ["string", "null"] },
    status: { type: "string", enum: ROLE_STATUS_VALUES },
    tags: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
    prompt: {
      type: "object",
      additionalProperties: false,
      properties: rolePromptSchema.properties,
    },
    llmProfile: roleLlmProfileSchema,
  },
} as const;

export const roleRouteSchemas = {
  listRoles: {
    tags: ["Role"],
    summary: "List roles",
    operationId: "listRoles",
    querystring: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: {
          type: "string",
          enum: ROLE_STATUS_VALUES,
        },
        sortBy: {
          type: "string",
          enum: ["createdAt", "updatedAt", "name"],
        },
        sortOrder: {
          type: "string",
          enum: ["asc", "desc"],
        },
      },
    },
    response: {
      200: successEnvelope({
        type: "array",
        items: roleSchema,
      }),
      500: errorEnvelope,
    },
  },
  getRole: {
    tags: ["Role"],
    summary: "Get role detail",
    operationId: "getRole",
    params: idParamsSchema,
    response: {
      200: successEnvelope(roleSchema),
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  createRole: {
    tags: ["Role"],
    summary: "Create role",
    operationId: "createRole",
    body: roleMutationBodySchema,
    response: {
      200: successEnvelope(roleSchema),
      500: errorEnvelope,
    },
  },
  updateRole: {
    tags: ["Role"],
    summary: "Update role",
    operationId: "updateRole",
    params: idParamsSchema,
    body: roleMutationBodySchema,
    response: {
      200: successEnvelope(roleSchema),
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
  deleteRole: {
    tags: ["Role"],
    summary: "Delete role",
    operationId: "deleteRole",
    params: idParamsSchema,
    response: {
      200: successEnvelope(deletedResponseSchema),
      404: errorEnvelope,
      500: errorEnvelope,
    },
  },
} as const;
