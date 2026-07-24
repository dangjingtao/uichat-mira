import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInvocationInputHash } from "@/agent/approval-fingerprint.js";

const mocks = vi.hoisted(() => ({
  executeDocument: vi.fn(),
}));

vi.mock("@/mcp/tools/office-document.tool.js", () => ({
  officeDocumentTool: {
    definition: {
      id: "office_document",
      title: "Office Document",
      description: "Create documents",
      inputSchema: { type: "object", additionalProperties: true },
      capabilities: { requiresApproval: true },
    },
    execute: mocks.executeDocument,
  },
}));
vi.mock("@/mcp/tools/office-pdf.tool.js", () => ({
  officePdfTool: {
    definition: { id: "office_pdf" },
    execute: vi.fn(),
  },
}));
vi.mock("@/mcp/tools/office-presentation.tool.js", () => ({
  officePresentationTool: {
    definition: { id: "office_presentation" },
    execute: vi.fn(),
  },
}));
vi.mock("@/mcp/tools/office-spreadsheet.tool.js", () => ({
  officeSpreadsheetTool: {
    definition: { id: "office_spreadsheet" },
    execute: vi.fn(),
  },
}));
vi.mock("@/mcp/workspace.js", () => ({
  runWithWorkspaceRootOverride: async (_root: string, run: () => unknown) => await run(),
}));
vi.mock("@/harness/environment.js", () => ({
  getHarnessEnvironmentSnapshot: () => ({}),
}));

import { createPrivateWenShuRuntimeToolBinding } from "./tool-adapters.js";

describe("private WenShu runtime approval consumption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeDocument.mockResolvedValue({
      result: { status: "completed" },
      evidence: { status: "completed" },
    });
  });

  it("consumes one exact approval once inside a fork", async () => {
    const args = { operation: "create", outputPath: "smoke.docx" };
    const inputHash = createInvocationInputHash(args);
    const binding = createPrivateWenShuRuntimeToolBinding({
      runtimeId: "office_document",
      execution: {
        goal: "Create smoke.docx",
        skillContext: {
          instruction: "Create documents safely.",
          primary: {
            id: "docx",
            version: "1.0.0",
            name: "DOCX",
            body: "Create documents safely.",
          },
          resources: [],
          disclosedResources: [],
        },
        workspaceRoot: "/workspace",
        approvedInvocations: [
          {
            toolId: "office_document",
            inputHash,
            input: args,
          },
        ],
      },
    });

    const first = await binding.execute(args);
    const second = await binding.execute(args);

    expect(mocks.executeDocument).toHaveBeenCalledOnce();
    expect(first.requirement).toBeUndefined();
    expect(second.terminate).toBe(true);
    expect(second.requirement).toMatchObject({
      kind: "approval",
      toolId: "office_document",
      inputHash,
      input: args,
    });
  });
});
