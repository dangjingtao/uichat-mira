import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInvocationInputHash } from "@/agent/approval-fingerprint.js";

const mocks = vi.hoisted(() => ({
  executeDocument: vi.fn(),
  executePdf: vi.fn(),
  executeSpreadsheet: vi.fn(),
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
    definition: {
      id: "office_pdf",
      title: "Office PDF",
      description: "Create PDFs",
      inputSchema: { type: "object", additionalProperties: true },
      capabilities: { requiresApproval: true },
    },
    execute: mocks.executePdf,
  },
}));
vi.mock("@/mcp/tools/office-presentation.tool.js", () => ({
  officePresentationTool: {
    definition: {
      id: "office_presentation",
      title: "Office Presentation",
      description: "Create presentations",
      inputSchema: { type: "object", additionalProperties: true },
      capabilities: { requiresApproval: true },
    },
    execute: vi.fn(),
  },
}));
vi.mock("@/mcp/tools/office-spreadsheet.tool.js", () => ({
  officeSpreadsheetTool: {
    definition: {
      id: "office_spreadsheet",
      title: "Office Spreadsheet",
      description: "Inspect spreadsheets",
      inputSchema: { type: "object", additionalProperties: true },
      capabilities: { requiresApproval: true },
    },
    execute: mocks.executeSpreadsheet,
  },
}));
vi.mock("@/mcp/workspace.js", () => ({
  resolveWorkspacePath: (value: string) => `/workspace/${value}`,
  runWithWorkspaceRootOverride: async (_root: string, run: () => unknown) => await run(),
}));
vi.mock("@/harness/environment.js", () => ({
  getHarnessEnvironmentSnapshot: () => ({}),
}));

import { createPrivateWenShuRuntimeToolBinding } from "./tool-adapters.js";

const skillContext = {
  instruction: "Create documents safely.",
  primary: {
    id: "docx",
    version: "1.0.0",
    name: "DOCX",
    body: "Create documents safely.",
  },
  resources: [],
  disclosedResources: [],
};

describe("private WenShu runtime governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeDocument.mockResolvedValue({
      result: { status: "completed" },
      evidence: { status: "completed" },
    });
    mocks.executeSpreadsheet.mockResolvedValue({
      result: { operation: "inspect", sheets: ["Sheet1"] },
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
        skillContext,
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

  it("executes spreadsheet inspect without requesting write approval", async () => {
    const args = { operation: "inspect", inputPath: "aaa.xlsx" };
    const binding = createPrivateWenShuRuntimeToolBinding({
      runtimeId: "office_spreadsheet",
      execution: {
        goal: "Inspect aaa.xlsx without modifying it",
        skillContext: {
          ...skillContext,
          primary: { ...skillContext.primary, id: "xlsx", name: "XLSX" },
        },
        workspaceRoot: "/workspace",
      },
    });

    const result = await binding.execute(args);

    expect(result.requirement).toBeUndefined();
    expect(mocks.executeSpreadsheet).toHaveBeenCalledOnce();
    expect(mocks.executeSpreadsheet.mock.calls[0]?.[0].approval.granted).toBe(true);
  });

  it("rejects title-only PDF creation before approval or runtime execution", async () => {
    const binding = createPrivateWenShuRuntimeToolBinding({
      runtimeId: "office_pdf",
      execution: {
        goal: "Create a PDF report",
        skillContext: {
          ...skillContext,
          primary: { ...skillContext.primary, id: "pdf", name: "PDF" },
        },
        workspaceRoot: "/workspace",
      },
    });

    await expect(
      binding.execute({
        operation: "create",
        outputPath: "smoke.pdf",
        spec: { title: "Smoke", blocks: [] },
      }),
    ).rejects.toThrow("title-only PDF");
    expect(mocks.executePdf).not.toHaveBeenCalled();
  });
});
