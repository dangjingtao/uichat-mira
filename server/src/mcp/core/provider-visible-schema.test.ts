import { describe, expect, it } from "vitest";
import { createProviderVisibleInputSchema } from "./provider-visible-schema.js";

describe("provider-visible input schema", () => {
  const runtimeSchema = {
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["operation", "repository"],
        properties: {
          operation: { type: "string", enum: ["get"] },
          repository: { type: "string" },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: [
          "operation",
          "repository",
          "path",
          "content",
          "commitMessage",
          "branch",
        ],
        properties: {
          operation: { type: "string", enum: ["write_file"] },
          repository: { type: "string" },
          path: { type: "string" },
          content: { type: "string" },
          commitMessage: { type: "string" },
          branch: { type: "string" },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["operation", "owner", "name", "visibility"],
        properties: {
          operation: { type: "string", enum: ["create"] },
          owner: { type: "string" },
          name: { type: "string" },
          visibility: { type: "string", enum: ["public", "private"] },
        },
      },
    ],
  };

  it("keeps all variant fields but only globally requires common fields", () => {
    expect(createProviderVisibleInputSchema(runtimeSchema)).toEqual({
      type: "object",
      additionalProperties: true,
      required: ["operation"],
      properties: {
        operation: {
          type: "string",
          enum: ["get", "write_file", "create"],
          description:
            "Selects the operation-specific runtime contract. Supply the fields required by that operation.",
        },
        repository: { type: "string" },
        path: { type: "string" },
        content: { type: "string" },
        commitMessage: { type: "string" },
        branch: { type: "string" },
        owner: { type: "string" },
        name: { type: "string" },
        visibility: { type: "string", enum: ["public", "private"] },
      },
    });
  });

  it("does not mutate the canonical runtime schema", () => {
    const before = structuredClone(runtimeSchema);

    createProviderVisibleInputSchema(runtimeSchema);

    expect(runtimeSchema).toEqual(before);
    expect(runtimeSchema).toHaveProperty("oneOf");
  });

  it("returns schemas without root oneOf unchanged", () => {
    const simpleSchema = {
      type: "object",
      required: ["query"],
      properties: { query: { type: "string" } },
    };

    expect(createProviderVisibleInputSchema(simpleSchema)).toBe(simpleSchema);
  });
});
