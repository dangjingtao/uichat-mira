import { describe, expect, it } from "vitest";
import { validateInvocationArgs } from "./schema.js";

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
});
