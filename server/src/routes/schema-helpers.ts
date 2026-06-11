import {
  MESSAGE_ROLE_VALUES,
  MODEL_TYPE_VALUES,
  USER_ROLE_VALUES,
} from "@/constants/domain.js";
import { PROVIDER_STATUS_VALUES } from "@/providers/codes.js";

type JsonSchema = Record<string, unknown>;

export const successEnvelope = (dataSchema: JsonSchema) => ({
  type: "object",
  required: ["success", "data", "timestamp"],
  properties: {
    success: { type: "boolean", const: true },
    data: dataSchema,
    message: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
  },
});

export const errorEnvelope = {
  type: "object",
  required: ["success", "message", "timestamp"],
  properties: {
    success: { type: "boolean", const: false },
    message: { type: "string" },
    code: { type: "string" },
    errors: {
      type: "array",
      items: {},
    },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;

export const userSchema = {
  type: "object",
  required: ["id", "username", "role"],
  properties: {
    id: { type: "number" },
    username: { type: "string" },
    role: { type: "string", enum: USER_ROLE_VALUES },
  },
} as const;

export const modelTypeSchema = {
  type: "string",
  enum: MODEL_TYPE_VALUES,
} as const;

export const messageRoleSchema = {
  type: "string",
  enum: MESSAGE_ROLE_VALUES,
} as const;

export const providerStatusSchema = {
  type: "string",
  enum: PROVIDER_STATUS_VALUES,
} as const;

export const idParamsSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string" },
  },
} as const;

export const deletedResponseSchema = {
  type: "object",
  required: ["deleted"],
  properties: {
    deleted: { type: "boolean" },
  },
} as const;
