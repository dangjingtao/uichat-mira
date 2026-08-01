import { mcpBadRequest } from "./errors.js";

type JsonSchema = Record<string, unknown>;

const describePath = (pathSegments: string[]) => {
  if (pathSegments.length === 0) {
    return "args";
  }

  return `args.${pathSegments.join(".")}`;
};

const assertObject = (
  value: unknown,
  pathSegments: string[],
): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw mcpBadRequest(`${describePath(pathSegments)} must be an object`);
  }

  return value as Record<string, unknown>;
};

const asSchemaObject = (value: unknown): JsonSchema | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonSchema)
    : undefined;

const getStringDiscriminatorValues = (schema: JsonSchema | undefined) => {
  if (!schema) return [];
  const values: string[] = [];
  if (typeof schema.const === "string") values.push(schema.const);
  if (Array.isArray(schema.enum)) {
    for (const value of schema.enum) {
      if (typeof value === "string") values.push(value);
    }
  }
  return [...new Set(values)];
};

const validatePrimitiveType = (
  value: unknown,
  expectedType: string,
  pathSegments: string[],
) => {
  const label = describePath(pathSegments);

  switch (expectedType) {
    case "string":
      if (typeof value !== "string") {
        throw mcpBadRequest(`${label} must be a string`);
      }
      return;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw mcpBadRequest(`${label} must be a finite number`);
      }
      return;
    case "integer":
      if (!Number.isInteger(value)) {
        throw mcpBadRequest(`${label} must be an integer`);
      }
      return;
    case "boolean":
      if (typeof value !== "boolean") {
        throw mcpBadRequest(`${label} must be a boolean`);
      }
      return;
    case "object":
      assertObject(value, pathSegments);
      return;
    default:
      return;
  }
};

const validateDiscriminatedOneOf = (
  value: unknown,
  candidates: unknown[],
  pathSegments: string[],
) => {
  const declaredOperations: string[] = [];
  const candidateEntries: Array<{
    schema: JsonSchema;
    operations: string[];
  }> = [];

  for (const candidate of candidates) {
    const candidateSchema = asSchemaObject(candidate);
    if (!candidateSchema) continue;
    const properties = asSchemaObject(candidateSchema.properties);
    const operationSchema = asSchemaObject(properties?.operation);
    const operationValues = getStringDiscriminatorValues(operationSchema);
    if (operationValues.length === 0) continue;
    declaredOperations.push(...operationValues);
    candidateEntries.push({
      schema: candidateSchema,
      operations: operationValues,
    });
  }

  const uniqueOperations = [...new Set(declaredOperations)];
  if (uniqueOperations.length === 0) return false;

  const objectValue = assertObject(value, pathSegments);
  const operation = objectValue.operation;
  const operationPath = [...pathSegments, "operation"];
  if (operation === undefined) {
    throw mcpBadRequest(`${describePath(operationPath)} is required`);
  }
  if (typeof operation !== "string") {
    throw mcpBadRequest(`${describePath(operationPath)} must be a string`);
  }

  const matchingCandidates = candidateEntries
    .filter((candidate) => candidate.operations.includes(operation))
    .map((candidate) => candidate.schema);

  if (matchingCandidates.length === 0) {
    throw mcpBadRequest(
      `${describePath(operationPath)} must be one of: ${uniqueOperations.join(", ")}`,
    );
  }

  if (matchingCandidates.length !== 1) return false;
  validateAgainstSchema(value, matchingCandidates[0], pathSegments);
  return true;
};

function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  pathSegments: string[],
) {
  if (Array.isArray(schema.oneOf)) {
    if (validateDiscriminatedOneOf(value, schema.oneOf, pathSegments)) {
      return;
    }

    let matches = 0;
    for (const candidate of schema.oneOf) {
      const candidateSchema = asSchemaObject(candidate);
      if (!candidateSchema) continue;
      try {
        validateAgainstSchema(value, candidateSchema, pathSegments);
        matches += 1;
      } catch {
        // Generic oneOf validation only needs the match count.
      }
    }
    if (matches !== 1) {
      throw mcpBadRequest(
        `${describePath(pathSegments)} must match exactly one schema variant`,
      );
    }
    return;
  }

  const schemaType = typeof schema.type === "string" ? schema.type : undefined;

  if (schemaType === "object") {
    const objectValue = assertObject(value, pathSegments);
    const properties =
      schema.properties && typeof schema.properties === "object" && !Array.isArray(schema.properties)
        ? (schema.properties as Record<string, JsonSchema>)
        : {};
    const required =
      Array.isArray(schema.required) && schema.required.every((item) => typeof item === "string")
        ? (schema.required as string[])
        : [];
    const additionalProperties = schema.additionalProperties;

    for (const key of required) {
      if (!(key in objectValue)) {
        throw mcpBadRequest(`${describePath([...pathSegments, key])} is required`);
      }
    }

    for (const [key, nextValue] of Object.entries(objectValue)) {
      const nextSchema = properties[key];
      if (nextSchema) {
        validateAgainstSchema(nextValue, nextSchema, [...pathSegments, key]);
        continue;
      }

      if (additionalProperties === false) {
        throw mcpBadRequest(`${describePath([...pathSegments, key])} is not allowed`);
      }
    }

    return;
  }

  if (schemaType === "array") {
    if (!Array.isArray(value)) {
      throw mcpBadRequest(`${describePath(pathSegments)} must be an array`);
    }

    const itemSchema =
      schema.items && typeof schema.items === "object" && !Array.isArray(schema.items)
        ? (schema.items as JsonSchema)
        : undefined;

    if (itemSchema) {
      value.forEach((entry, index) => {
        validateAgainstSchema(entry, itemSchema, [...pathSegments, String(index)]);
      });
    }

    return;
  }

  if (schemaType) {
    validatePrimitiveType(value, schemaType, pathSegments);
  }

  if (schema.const !== undefined && schema.const !== value) {
    throw mcpBadRequest(
      `${describePath(pathSegments)} must equal ${String(schema.const)}`,
    );
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => entry === value)) {
    throw mcpBadRequest(
      `${describePath(pathSegments)} must be one of: ${schema.enum.map(String).join(", ")}`,
    );
  }
}

export const validateInvocationArgs = (
  args: Record<string, unknown>,
  schema: JsonSchema,
) => {
  validateAgainstSchema(args, schema, []);
};
