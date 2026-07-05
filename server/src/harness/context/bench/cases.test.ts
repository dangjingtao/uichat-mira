import { describe, expect, it } from "vitest";
import { runContextReadBenchCases } from "./cases.js";

describe("context read bench", () => {
  it("covers context and read scenarios without failures", async () => {
    const report = await runContextReadBenchCases();

    expect(report.cases).toHaveLength(11);
    expect(report.cases.every((item) => item.status === "passed")).toBe(true);
    expect(report.cases.find((item) => item.caseId === "read-open-gbk")?.encoding).toMatch(
      /^(uncertain|decoded)$/,
    );
    expect(report.cases.find((item) => item.caseId === "read-open-binary")?.encoding).toBe(
      "binaryDetected",
    );
    expect(report.cases.find((item) => item.caseId === "inspect-max-files")?.filesRead).toBe(1);
  });
});
