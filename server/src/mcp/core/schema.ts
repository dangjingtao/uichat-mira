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

const validateAgainstSchema = (
  value: unknown,
  schema: JsonSchema,
  pathSegments: string[],
) => {
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

  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => entry === value)) {
    throw mcpBadRequest(
      `${describePath(pathSegments)} must be one of: ${schema.enum.map(String).join(", ")}`,
    );
  }
};

export const validateInvocationArgs = (
  args: Record<string, unknown>,
  schema: JsonSchema,
) => {
  validateAgainstSchema(args, schema, []);
};
