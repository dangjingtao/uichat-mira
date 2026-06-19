import {
  PROVIDER_CODE_ENUM,
  providerCodeSchema,
} from "@/providers/catalog.js";
import {
  errorEnvelope,
  modelTypeSchema,
  providerStatusSchema,
  successEnvelope,
} from "@/routes/schema-helpers.js";

// Provider summary for settings lists. It intentionally excludes decrypted API
// keys while surfacing enough status for connection management.
export const providerSummarySchema = {
  type: "object",
  required: [
    "code",
    "displayName",
    "baseUrl",
    "hasApiKey",
    "status",
    "lastError",
    "lastSyncedAt",
    "assignedRoles",
  ],
  properties: {
    code: {
      type: "string",
      description: "Provider code from the centralized catalog.",
      enum: PROVIDER_CODE_ENUM,
    },
    displayName: {
      type: "string",
      description: "Human-readable provider name shown in settings.",
    },
    baseUrl: {
      type: "string",
      description: "Saved base URL used for provider calls.",
    },
    hasApiKey: {
      type: "boolean",
      description: "Whether an encrypted API key is stored.",
    },
    status: {
      ...providerStatusSchema,
      description: "Last known provider connection status.",
    },
    lastError: {
      description: "Last sync/connection error when present.",
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    lastSyncedAt: {
      description: "ISO timestamp from the latest successful model sync.",
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
    assignedRoles: {
      type: "array",
      description: "Model roles currently assigned to this provider.",
      items: modelTypeSchema,
    },
  },
} as const;

// Role assignment embedded in provider detail responses.
const roleAssignmentSchema = {
  anyOf: [
    {
      type: "object",
      required: ["providerCode", "remoteModelId", "modelName"],
      properties: {
        providerCode: {
          type: "string",
          description: "Provider owning the assigned remote model.",
          enum: PROVIDER_CODE_ENUM,
        },
        remoteModelId: {
          type: "string",
          description: "Remote provider model id assigned to the role.",
        },
        modelName: {
          type: "string",
          description: "Display name for the assigned model.",
        },
      },
    },
    { type: "null" },
  ],
} as const;

// Model config returned after selecting or resetting a role assignment.
export const roleModelConfigSchema = {
  type: "object",
  required: [
    "id",
    "type",
    "name",
    "providerCode",
    "remoteModelId",
    "params",
    "isDefault",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    id: { type: "string", description: "Local model config identifier." },
    type: {
      ...modelTypeSchema,
      description: "Model role controlled by this config.",
    },
    name: { type: "string", description: "Display name for the config." },
    providerCode: {
      description: "Assigned provider code, or null when reset.",
      anyOf: [{ type: "string", enum: PROVIDER_CODE_ENUM }, { type: "null" }],
    },
    remoteModelId: {
      description: "Assigned remote model id, or null when reset.",
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    params: {
      type: "object",
      description: "Role-specific model parameters reset by assignment changes.",
      additionalProperties: true,
    },
    isDefault: {
      type: "boolean",
      description: "Whether this is the default config for its role.",
    },
    createdAt: {
      type: "string",
      format: "date-time",
      description: "ISO creation timestamp.",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      description: "ISO last-update timestamp.",
    },
  },
} as const;

const providerParamsSchema = {
  type: "object",
  properties: {
    providerCode: {
      ...providerCodeSchema,
      description: "Provider code from the centralized provider catalog.",
    },
  },
  required: ["providerCode"],
} as const;

const providerModelItemSchema = {
  type: "object",
  required: ["id", "name"],
  properties: {
    id: {
      type: "string",
      description: "Remote provider model identifier.",
    },
    name: {
      type: "string",
      description: "Display name for the remote model.",
    },
  },
} as const;

const providerConnectionResponseSchema = {
  type: "object",
  required: [
    "providerCode",
    "displayName",
    "baseUrl",
    "isEnabled",
    "status",
    "createdAt",
    "updatedAt",
  ],
  properties: {
    providerCode: {
      ...providerCodeSchema,
      description: "Provider code saved by the connection.",
    },
    displayName: {
      type: "string",
      description: "Human-readable provider name.",
    },
    baseUrl: {
      type: "string",
      description: "Saved provider base URL.",
    },
    apiKeyEncrypted: {
      description: "Encrypted API key stored by the backend, when present.",
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    isEnabled: {
      type: "boolean",
      description: "Whether provider calls are enabled.",
    },
    status: {
      ...providerStatusSchema,
      description: "Provider connection status.",
    },
    lastError: {
      description: "Last connection or sync error.",
      anyOf: [{ type: "string" }, { type: "null" }],
    },
    lastSyncedAt: {
      description: "ISO timestamp from the latest successful model sync.",
      anyOf: [{ type: "string", format: "date-time" }, { type: "null" }],
    },
    createdAt: {
      type: "string",
      format: "date-time",
      description: "ISO creation timestamp.",
    },
    updatedAt: {
      type: "string",
      format: "date-time",
      description: "ISO last-update timestamp.",
    },
  },
} as const;

// OpenAPI route schemas for provider settings. The split mirrors the route
// groups: connections, model sync, and role assignment.
export const providerSettingsRouteSchemas = {
  listProviders: {
    tags: ["Provider Settings"],
    summary: "List provider summaries",
    description:
      "Return the configured provider platforms with connection status and assigned roles.",
    operationId: "listProviderSummaries",
    response: {
      200: successEnvelope({
        type: "array",
        items: providerSummarySchema,
      }),
      500: errorEnvelope,
    },
  },
  getProviderDetail: {
    tags: ["Provider Settings"],
    summary: "Get provider detail",
    description:
      "Return one provider's saved connection config, synced model list, and role assignments.",
    operationId: "getProviderDetail",
    params: providerParamsSchema,
    response: {
      200: successEnvelope({
        type: "object",
        required: ["provider", "models", "assignments"],
        properties: {
          provider: {
            type: "object",
            required: [
              "code",
              "displayName",
              "baseUrl",
              "apiKey",
              "hasApiKey",
              "status",
              "lastError",
              "lastSyncedAt",
            ],
            properties: {
              code: {
                ...providerCodeSchema,
                description: "Provider code from the catalog.",
              },
              displayName: {
                type: "string",
                description: "Human-readable provider name.",
              },
              baseUrl: {
                type: "string",
                description: "Saved provider base URL.",
              },
              apiKey: {
                type: "string",
                description: "Decrypted API key for editing in settings.",
              },
              hasApiKey: {
                type: "boolean",
                description: "Whether an encrypted API key is stored.",
              },
              status: {
                ...providerStatusSchema,
                description: "Provider connection status.",
              },
              lastError: {
                description: "Last connection or sync error.",
                anyOf: [{ type: "string" }, { type: "null" }],
              },
              lastSyncedAt: {
                description: "ISO timestamp from the latest model sync.",
                anyOf: [
                  { type: "string", format: "date-time" },
                  { type: "null" },
                ],
              },
            },
          },
          models: {
            type: "array",
            description: "Models cached from the provider.",
            items: providerModelItemSchema,
          },
          assignments: {
            type: "object",
            description: "Current default model assignment by role.",
            required: ["llm", "embedding", "rerank", "task", "evaluation"],
            properties: {
              llm: roleAssignmentSchema,
              embedding: roleAssignmentSchema,
              rerank: roleAssignmentSchema,
              task: roleAssignmentSchema,
              evaluation: roleAssignmentSchema,
            },
          },
        },
      }),
      500: errorEnvelope,
    },
  },
  saveProviderConnection: {
    tags: ["Provider Settings"],
    summary: "Save provider connection config",
    description:
      "Persist base URL and API key for a provider. This does not sync models yet.",
    operationId: "saveProviderConnectionConfig",
    params: providerParamsSchema,
    body: {
      type: "object",
      properties: {
        baseUrl: {
          type: "string",
          description: "Provider base URL used by backend calls.",
        },
        apiKey: {
          type: "string",
          description: "Plain API key; service code encrypts it before storage.",
        },
      },
      required: ["baseUrl", "apiKey"],
    },
    response: {
      200: successEnvelope(providerConnectionResponseSchema),
      500: errorEnvelope,
    },
  },
  syncProviderModels: {
    tags: ["Provider Settings"],
    summary: "Sync provider models",
    description:
      "Use the backend to fetch models from the provider and refresh the local provider model cache.",
    operationId: "syncProviderModels",
    params: providerParamsSchema,
    response: {
      200: successEnvelope({
        type: "object",
        required: ["provider", "models"],
        properties: {
          provider: providerSummarySchema,
          models: {
            type: "array",
            description: "Models returned by provider discovery.",
            items: providerModelItemSchema,
          },
        },
      }),
      400: errorEnvelope,
      500: errorEnvelope,
    },
  },
  selectRoleModel: {
    tags: ["Provider Settings"],
    summary: "Select default model for role",
    description:
      "Assign a provider model to a role and reset that role's params to backend defaults.",
    operationId: "selectDefaultProviderModelForRole",
    params: {
      type: "object",
      properties: {
        providerCode: providerCodeSchema,
        role: {
          ...modelTypeSchema,
          description: "Model role receiving the selected provider model.",
        },
      },
      required: ["providerCode", "role"],
    },
    body: {
      type: "object",
      properties: {
        remoteModelId: {
          type: "string",
          description: "Remote model id selected from the provider model cache.",
        },
        baseUrl: {
          type: "string",
          description:
            "Optional provider base URL to persist together with the role selection.",
        },
        apiKey: {
          type: "string",
          description:
            "Optional plain API key to persist together with the role selection.",
        },
      },
      required: ["remoteModelId"],
    },
    response: {
      200: successEnvelope(roleModelConfigSchema),
      400: errorEnvelope,
      500: errorEnvelope,
    },
  },
  resetRoleModel: {
    tags: ["Provider Settings"],
    summary: "Reset default model for role",
    description:
      "Clear provider and remote model fields for a role while resetting params to backend defaults.",
    operationId: "resetDefaultProviderModelForRole",
    params: {
      type: "object",
      properties: {
        role: {
          ...modelTypeSchema,
          description: "Model role whose assignment should be cleared.",
        },
      },
      required: ["role"],
    },
    response: {
      200: successEnvelope(roleModelConfigSchema),
      400: errorEnvelope,
      500: errorEnvelope,
    },
  },
} as const;
