import { describe, expect, it } from "vitest";
import { buildHarnessSandboxPlan, mergeNodeOptions } from "./sandbox.js";

describe("harness sandbox plan", () => {
  it("keeps sandbox off by default", () => {
    delete process.env.MCP_HARNESS_SANDBOX_POC;

    const plan = buildHarnessSandboxPlan({
      cwd: "D:\\workspace\\rag-demo",
    });

    expect(plan.mode).toBe("off");
    expect(plan.nodeOptions).toBeUndefined();
  });

  it("builds node permission options when enabled", () => {
    process.env.MCP_HARNESS_SANDBOX_POC = "1";

    const plan = buildHarnessSandboxPlan({
      cwd: "D:\\workspace\\rag-demo",
    });

    expect(plan.mode).toBe("node-permission");
    expect(plan.nodeOptions).toContain("--permission");
    expect(plan.nodeOptions).toContain("--allow-net");
    expect(plan.nodeOptions).toContain("--allow-fs-read");
  });

  it("merges node options without dropping existing values", () => {
    expect(mergeNodeOptions("--trace-warnings", "--permission")).toBe(
      "--trace-warnings --permission",
    );
  });
});
