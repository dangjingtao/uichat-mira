import path from "node:path";
import { runSandboxDirectBenchCases } from "./cases.js";
import type { SandboxBenchReport } from "../contract.js";

const resolveWorkspaceRoot = () => path.resolve(process.argv[2] ?? process.cwd());

const main = async () => {
  const workspaceRoot = resolveWorkspaceRoot();
  const { contractCoverage, cases } = await runSandboxDirectBenchCases(workspaceRoot);

  const report: SandboxBenchReport = {
    runner: "sandbox-direct-bench",
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    contractCoverage: {
      profiles: contractCoverage,
    },
    summary: {
      total: cases.length,
      passed: cases.filter((item) => item.status === "passed").length,
      failed: cases.filter((item) => item.status === "failed").length,
      notImplemented: cases.filter((item) => item.status === "not_implemented").length,
    },
    cases,
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.summary.failed > 0) {
    process.exitCode = 1;
  }
};

void main();
