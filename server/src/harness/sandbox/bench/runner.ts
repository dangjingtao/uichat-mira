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
    contractCoverage,
    summary: {
      total: cases.length,
      gatePassed: cases.filter((item) => item.status === "passed").length,
      gateFailed: cases.filter((item) => item.status === "failed").length,
      blockedProfile: cases.filter((item) => item.status === "blocked").length,
    },
    cases,
  };

  console.log(JSON.stringify(report, null, 2));
  if (report.summary.gateFailed > 0) {
    process.exitCode = 1;
  }
};

void main();
