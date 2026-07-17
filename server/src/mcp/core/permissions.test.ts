import { describe, expect, it } from "vitest";
import { createInvocationInputHash } from "@/agent/approval-fingerprint.js";
import { evaluateInvocationApproval, hasExactApprovedInvocation } from "./permissions.js";
import { pythonSessionTool } from "../tools/python-session.tool.js";

const terminalDefinition = {
  id: "terminal_session",
  title: "Terminal Session",
  description: "terminal",
  domain: "terminal" as const,
  source: "internal" as const,
  mode: "stream" as const,
  inputSchema: {
    type: "object",
    required: ["command"],
    properties: {
      command: { type: "string" },
      cwd: { type: "string" },
      env: { type: "object" },
      timeoutMs: { type: "number" },
      attachSessionId: { type: "string" },
    },
  },
  tags: ["terminal"],
  capabilities: {
    sideEffect: "process" as const,
    requiresApproval: true,
    workspaceBound: true,
    workspaceBoundary: {
      argKeys: ["cwd"],
    },
  },
};

describe("permissions exact approval reuse", () => {
  it.each([
    ["code", { code: "print(1)", cwd: ".", timeoutMs: 1000, artifactRegistrations: [{ path: "result.txt" }] }, { code: "print(2)", cwd: ".", timeoutMs: 1000, artifactRegistrations: [{ path: "result.txt" }] }],
    ["cwd", { code: "print(1)", cwd: "server", timeoutMs: 1000, artifactRegistrations: [{ path: "result.txt" }] }, { code: "print(1)", cwd: "desktop", timeoutMs: 1000, artifactRegistrations: [{ path: "result.txt" }] }],
    ["timeout", { code: "print(1)", cwd: ".", timeoutMs: 1000, artifactRegistrations: [{ path: "result.txt" }] }, { code: "print(1)", cwd: ".", timeoutMs: 2000, artifactRegistrations: [{ path: "result.txt" }] }],
    ["artifacts", { code: "print(1)", cwd: ".", timeoutMs: 1000, artifactRegistrations: [{ path: "result.txt" }] }, { code: "print(1)", cwd: ".", timeoutMs: 1000, artifactRegistrations: [{ path: "other.txt" }] }],
  ])("requires new approval when python_session changes %s", (_label, approvedArgs, nextArgs) => {
    const result = evaluateInvocationApproval({
      definition: pythonSessionTool.definition,
      args: nextArgs,
      approvedInvocations: [{ toolId: "python_session", inputHash: createInvocationInputHash(approvedArgs) }],
      inputHash: createInvocationInputHash(nextArgs),
    });
    expect(result).toEqual({
      type: "require_approval",
      reason: "python_session requires explicit approval before execution.",
      scope: "terminal",
    });
  });

  it("matches only the same toolId and exact inputHash", () => {
    const approvedArgs = {
      command: "pwd",
      cwd: ".",
    };

    expect(
      hasExactApprovedInvocation({
        toolId: "terminal_session",
        inputHash: createInvocationInputHash(approvedArgs),
        approvedInvocations: [
          {
            toolId: "terminal_session",
            inputHash: createInvocationInputHash(approvedArgs),
          },
        ],
      }),
    ).toBe(true);

    expect(
      hasExactApprovedInvocation({
        toolId: "workspace_mutation",
        inputHash: createInvocationInputHash(approvedArgs),
        approvedInvocations: [
          {
            toolId: "terminal_session",
            inputHash: createInvocationInputHash(approvedArgs),
          },
        ],
      }),
    ).toBe(false);
  });

  it.each([
    {
      label: "new command",
      approvedArgs: {
        command: "pwd",
        attachSessionId: "session-1",
      },
      nextArgs: {
        command: "git status",
        attachSessionId: "session-1",
      },
    },
    {
      label: "new cwd",
      approvedArgs: {
        command: "pwd",
        cwd: "server",
      },
      nextArgs: {
        command: "pwd",
        cwd: "desktop",
      },
    },
    {
      label: "new env",
      approvedArgs: {
        command: "echo hi",
        env: {
          FOO: "1",
        },
      },
      nextArgs: {
        command: "echo hi",
        env: {
          FOO: "2",
        },
      },
    },
    {
      label: "new timeout",
      approvedArgs: {
        command: "pnpm check",
        timeoutMs: 2000,
      },
      nextArgs: {
        command: "pnpm check",
        timeoutMs: 5000,
      },
    },
  ])("requires approval again when terminal_session receives $label", ({ approvedArgs, nextArgs }) => {
    const result = evaluateInvocationApproval({
      definition: terminalDefinition,
      args: nextArgs,
      approvedInvocations: [
        {
          toolId: "terminal_session",
          inputHash: createInvocationInputHash(approvedArgs),
        },
      ],
      inputHash: createInvocationInputHash(nextArgs),
    });

    expect(result).toEqual({
      type: "require_approval",
      reason: "terminal_session requires explicit approval before execution.",
      scope: "terminal",
    });
  });
});
