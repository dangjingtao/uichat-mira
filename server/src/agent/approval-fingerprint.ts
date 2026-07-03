import { createHash } from "node:crypto";

const sortJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortJson(nestedValue)]),
    );
  }

  return value;
};

export const normalizeInvocationInput = (
  input: Record<string, unknown>,
): string => JSON.stringify(sortJson(input));

export const createInvocationInputHash = (
  input: Record<string, unknown>,
): string =>
  createHash("sha256").update(normalizeInvocationInput(input)).digest("hex");
