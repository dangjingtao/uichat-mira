import { runContextReadBenchCases } from "./cases.js";
import type { ContextReadBenchReport } from "./contract.js";

const main = async () => {
  const { workspaceRoot, cases } = await runContextReadBenchCases();
  const report: ContextReadBenchReport = {
    runner: "context-read-bench",
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    summary: {
      total: cases.length,
      passed: cases.filter((item) => item.status === "passed").length,
      failed: cases.filter((item) => item.status === "failed").length,
    },
    cases,
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
};

void main();
