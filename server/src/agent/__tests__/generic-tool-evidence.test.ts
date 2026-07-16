import { describe, expect, it } from "vitest";
import { createToolExecutionEvidenceSummary } from "../evidence";

describe("generic MCP tool evidence", () => {
  it("passes standardized evidence through without knowing the tool id", () => {
    const summary = createToolExecutionEvidenceSummary({
      evidenceIndex: 0,
      execution: {
        toolId: "any-tool",
        args: {},
        status: "completed",
        startedAt: "2026-07-15T00:00:00.000Z",
        finishedAt: "2026-07-15T00:00:01.000Z",
        evidence: {
          actionTaken: "Observed a page.",
          facts: ["title=Example Domain", "url=https://example.com"],
          data: { kind: "opaque-tool-data", title: "Example Domain" },
        },
      },
    });

    expect(summary.actionTaken).toBe("Observed a page.");
    expect(summary.keyFindings).toEqual(["title=Example Domain", "url=https://example.com"]);
    expect(summary.data).toEqual({ kind: "opaque-tool-data", title: "Example Domain" });
  });
});
