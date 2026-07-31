import { describe, expect, it } from "vitest";
import { validateInvocationArgs } from "./schema.js";

const repositorySchema = {
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
  ],
};

describe("mcp schema validation", () => {
  it("accepts object args that satisfy the declared schema", () => {
    expect(() =>
      validateInvocationArgs(
        {
          path: "notes.txt",
          dryRun: true,
          extensions: [".md"],
        },
        {
          type: "object",
          required: ["path"],
          properties: {
            path: { type: "string" },
            dryRun: { type: "boolean" },
            extensions: {
              type: "array",
              items: { type: "string" },
            },
          },
          additionalProperties: false,
        },
      ),
    ).not.toThrow();
  });

  it("rejects missing required properties", () => {
    expect(() =>
      validateInvocationArgs(
        {},
        {
          type: "object",
          required: ["path"],
          properties: {
            path: { type: "string" },
          },
        },
      ),
    ).toThrow("args.path is required");
  });

  it("rejects type mismatches from the declared schema", () => {
    expect(() =>
      validateInvocationArgs(
        {
          timeoutMs: "1000",
        } as unknown as Record<string, unknown>,
        {
          type: "object",
          properties: {
            timeoutMs: { type: "number" },
          },
        },
      ),
    ).toThrow("args.timeoutMs must be a finite number");
  });

  it("rejects enum mismatches from the declared schema", () => {
    expect(() =>
      validateInvocationArgs(
        {
          sessionMode: "shared",
        },
        {
          type: "object",
          properties: {
            sessionMode: {
              type: "string",
              enum: ["ephemeral", "persistent"],
            },
          },
        },
      ),
    ).toThrow("args.sessionMode must be one of: ephemeral, persistent");
  });

  it("preserves the selected operation variant error", () => {
    expect(() =>
      validateInvocationArgs(
        {
          operation: "write_file",
          repository: "dangjingtao/uichat-mira",
          path: "README.md",
        },
        repositorySchema,
      ),
    ).toThrow("args.content is required");
  });

  it("reports allowed operations for a discriminated oneOf schema", () => {
    expect(() =>
      validateInvocationArgs(
        {
          operation: "publish",
          repository: "dangjingtao/uichat-mira",
        },
        repositorySchema,
      ),
    ).toThrow("args.operation must be one of: get, write_file");
  });
});
