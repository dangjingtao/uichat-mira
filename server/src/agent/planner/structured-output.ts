import type { AgentToolExposureState } from "../types";

export type PlannerStructuredPlanPatch = {
  addItems: Array<{ id: string; text: string }>;
  completeIds: string[];
};

export type PlannerStructuredDecisionEnvelope = {
  decision: Record<string, unknown>;
  planPatch: PlannerStructuredPlanPatch;
};

type JsonSchema = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const nullableSchema = (schema: JsonSchema): JsonSchema => ({
  anyOf: [schema, { type: "null" }],
});

/**
 * OpenAI strict JSON Schema requires every declared object property to be
 * required and every object to set additionalProperties=false. Tool schemas
 * use normal optional-property semantics, so optional fields are represented
 * as required-but-nullable for generation and stripped back to omission before
 * the existing Harness schema validator sees the args.
 */
const toStrictGenerationSchema = (
  value: unknown,
  requiredByParent = true,
): JsonSchema => {
  if (!isRecord(value)) {
    return requiredByParent ? {} : nullableSchema({});
  }

  if (Array.isArray(value.anyOf)) {
    const schema = {
      ...value,
      anyOf: value.anyOf.map((item) => toStrictGenerationSchema(item, true)),
    };
    return requiredByParent ? schema : nullableSchema(schema);
  }

  if (Array.isArray(value.oneOf)) {
    const schema = {
      ...value,
      oneOf: value.oneOf.map((item) => toStrictGenerationSchema(item, true)),
    };
    return requiredByParent ? schema : nullableSchema(schema);
  }

  if (value.type === "object" || isRecord(value.properties)) {
    const properties = isRecord(value.properties) ? value.properties : {};
    const originalRequired = new Set(
      Array.isArray(value.required)
        ? value.required.filter((item): item is string => typeof item === "string")
        : [],
    );
    const strictProperties = Object.fromEntries(
      Object.entries(properties).map(([key, schema]) => [
        key,
        toStrictGenerationSchema(schema, originalRequired.has(key)),
      ]),
    );
    const schema: JsonSchema = {
      ...value,
      type: "object",
      properties: strictProperties,
      required: Object.keys(strictProperties),
      additionalProperties: false,
    };
    return requiredByParent ? schema : nullableSchema(schema);
  }

  if (value.type === "array" && value.items) {
    const schema: JsonSchema = {
      ...value,
      items: toStrictGenerationSchema(value.items, true),
    };
    return requiredByParent ? schema : nullableSchema(schema);
  }

  const schema = { ...value };
  return requiredByParent ? schema : nullableSchema(schema);
};

const actionSchema = (
  properties: Record<string, JsonSchema>,
  required: string[],
): JsonSchema => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

const literalStringSchema = (value: string): JsonSchema => ({
  type: "string",
  enum: [value],
});

export const buildPlannerStructuredOutputJsonSchema = (
  toolExposure: AgentToolExposureState,
): JsonSchema => {
  const decisionVariants: JsonSchema[] = [
    actionSchema(
      {
        type: literalStringSchema("answer"),
        reason: { type: "string" },
      },
      ["type", "reason"],
    ),
    actionSchema(
      {
        type: literalStringSchema("retrieve"),
        query: { type: "string" },
        reason: { type: "string" },
      },
      ["type", "query", "reason"],
    ),
    actionSchema(
      {
        type: literalStringSchema("ask_user"),
        question: { type: "string" },
        reason: { type: "string" },
      },
      ["type", "question", "reason"],
    ),
    actionSchema(
      {
        type: literalStringSchema("error"),
        reason: { type: "string" },
      },
      ["type", "reason"],
    ),
  ];

  for (const toolId of toolExposure.exposedTools) {
    const meta = toolExposure.toolMeta.find((item) => item.toolId === toolId);
    const argsSchema = toStrictGenerationSchema(
      meta?.inputSchema ?? {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
      true,
    );
    decisionVariants.push(
      actionSchema(
        {
          type: literalStringSchema("use_tool"),
          toolId: literalStringSchema(toolId),
          args: argsSchema,
          reason: { type: "string" },
        },
        ["type", "toolId", "args", "reason"],
      ),
    );
  }

  return {
    type: "object",
    properties: {
      decision: {
        anyOf: decisionVariants,
      },
      planPatch: {
        type: "object",
        properties: {
          addItems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                text: { type: "string" },
              },
              required: ["id", "text"],
              additionalProperties: false,
            },
          },
          completeIds: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["addItems", "completeIds"],
        additionalProperties: false,
      },
    },
    required: ["decision", "planPatch"],
    additionalProperties: false,
  };
};

const stripGeneratedNulls = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripGeneratedNulls);
  }
  if (!isRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== null)
      .map(([key, child]) => [key, stripGeneratedNulls(child)]),
  );
};

export const normalizePlannerStructuredDecision = (
  envelope: PlannerStructuredDecisionEnvelope,
): Record<string, unknown> => {
  const decision = stripGeneratedNulls(envelope.decision) as Record<string, unknown>;
  const addItems = Array.isArray(envelope.planPatch?.addItems)
    ? envelope.planPatch.addItems
    : [];
  const completeIds = Array.isArray(envelope.planPatch?.completeIds)
    ? envelope.planPatch.completeIds
    : [];

  if (addItems.length === 0 && completeIds.length === 0) {
    return decision;
  }

  return {
    ...decision,
    planPatch: {
      addItems,
      completeIds,
    },
  };
};
