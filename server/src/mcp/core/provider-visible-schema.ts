type JsonSchema = Record<string, unknown>;

const asRecord = (value: unknown): JsonSchema | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonSchema)
    : undefined;

const getStringValues = (schema: JsonSchema | undefined) => {
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

const getSchemaType = (schema: JsonSchema) =>
  typeof schema.type === "string" ? schema.type : undefined;

const sanitizeProviderPropertySchema = (schema: unknown): JsonSchema => {
  const record = asRecord(schema) ?? {};
  const composedCandidates = [record.oneOf, record.anyOf, record.allOf]
    .find(Array.isArray) as unknown[] | undefined;

  if (composedCandidates) {
    const candidateTypes = [
      ...new Set(
        composedCandidates
          .map((candidate) => asRecord(candidate))
          .map((candidate) => candidate && getSchemaType(candidate))
          .filter((value): value is string => Boolean(value)),
      ),
    ];
    const description =
      typeof record.description === "string"
        ? record.description
        : candidateTypes.length > 1
          ? `Accepted value types: ${candidateTypes.join(" or ")}.`
          : undefined;

    return {
      ...(candidateTypes.length === 1 ? { type: candidateTypes[0] } : {}),
      ...(description ? { description } : {}),
    };
  }

  const sanitized: JsonSchema = {};
  for (const [key, value] of Object.entries(record)) {
    if (key === "oneOf" || key === "anyOf" || key === "allOf") continue;
    if (key === "const") continue;

    if (key === "properties") {
      const properties = asRecord(value);
      if (properties) {
        sanitized.properties = Object.fromEntries(
          Object.entries(properties).map(([name, property]) => [
            name,
            sanitizeProviderPropertySchema(property),
          ]),
        );
      }
      continue;
    }

    if (key === "items") {
      sanitized.items = sanitizeProviderPropertySchema(value);
      continue;
    }

    sanitized[key] = Array.isArray(value) ? [...value] : value;
  }

  if (record.const !== undefined) {
    sanitized.enum = [record.const];
  }

  return sanitized;
};

const mergeDescriptions = (left: JsonSchema, right: JsonSchema) => {
  const descriptions = [left.description, right.description]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .map((value) => value.trim());
  return [...new Set(descriptions)].join(" ") || undefined;
};

const mergeProviderPropertySchemas = (
  left: JsonSchema | undefined,
  right: JsonSchema,
): JsonSchema => {
  if (!left) return right;
  if (JSON.stringify(left) === JSON.stringify(right)) return left;

  const leftType = getSchemaType(left);
  const rightType = getSchemaType(right);
  const description = mergeDescriptions(left, right);

  if (leftType && leftType === rightType) {
    const leftEnum = Array.isArray(left.enum) ? left.enum : undefined;
    const rightEnum = Array.isArray(right.enum) ? right.enum : undefined;
    return {
      type: leftType,
      ...(leftEnum && rightEnum
        ? { enum: [...new Set([...leftEnum, ...rightEnum])] }
        : {}),
      ...(description ? { description } : {}),
    };
  }

  return description ? { description } : {};
};

/**
 * Converts a discriminated oneOf tool schema into a provider-friendly object
 * schema. Runtime validation continues to use the original strict schema.
 */
export const createProviderVisibleInputSchema = (
  schema: JsonSchema,
): JsonSchema => {
  if (!Array.isArray(schema.oneOf)) return schema;

  const variants = schema.oneOf
    .map((candidate) => asRecord(candidate))
    .filter((candidate): candidate is JsonSchema => Boolean(candidate));
  if (variants.length === 0) return schema;

  const properties: Record<string, JsonSchema> = {};
  const operationValues: string[] = [];
  let commonRequired: Set<string> | undefined;

  for (const variant of variants) {
    const required = new Set(
      Array.isArray(variant.required)
        ? variant.required.filter((value): value is string => typeof value === "string")
        : [],
    );
    commonRequired = commonRequired
      ? new Set([...commonRequired].filter((name) => required.has(name)))
      : required;

    const variantProperties = asRecord(variant.properties) ?? {};
    for (const [name, propertySchema] of Object.entries(variantProperties)) {
      if (name === "operation") {
        operationValues.push(...getStringValues(asRecord(propertySchema)));
        continue;
      }

      properties[name] = mergeProviderPropertySchemas(
        properties[name],
        sanitizeProviderPropertySchema(propertySchema),
      );
    }
  }

  const uniqueOperations = [...new Set(operationValues)];
  if (uniqueOperations.length > 0) {
    properties.operation = {
      type: "string",
      enum: uniqueOperations,
      description:
        "Selects the operation-specific runtime contract. Supply the fields required by that operation.",
    };
  }

  const required = [...(commonRequired ?? [])].filter(
    (name) => name === "operation" || name in properties,
  );

  return {
    type: "object",
    additionalProperties: true,
    ...(required.length > 0 ? { required } : {}),
    properties,
  };
};
