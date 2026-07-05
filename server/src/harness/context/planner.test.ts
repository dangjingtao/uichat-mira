import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONTEXT_READ_BUDGET,
  buildContextReadPlanResult,
  normalizeContextReadBudget,
  planContextRead,
} from "./index.js";

describe("context read plan DSL", () => {
  it("selects open for an explicit file path", () => {
    const result = planContextRead({
      query: "请打开 docs/README.md",
    });

    expect(result.plan).toEqual({
      kind: "open",
      path: "docs/README.md",
    });
    expect(result.diagnostics.reasons[0]).toMatchObject({
      code: "explicit_path",
    });
  });

  it("selects list for directory intent", () => {
    const result = planContextRead({
      query: "列出 server/src/harness/ 目录下有哪些文件",
      budget: { maxDepth: 4 },
    });

    expect(result.plan).toEqual({
      kind: "list",
      path: "server/src/harness/",
      maxDepth: 4,
    });
    expect(result.diagnostics.reasons.map((reason) => reason.code)).toContain("directory_intent");
  });

  it("selects inspect for module understanding intent", () => {
    const result = planContextRead({
      query: "检查 harness planner 模块的调用链和实现",
      budget: { maxFiles: 5, maxChars: 9000 },
    });

    expect(result.plan).toEqual({
      kind: "inspect",
      query: "检查 harness planner 模块的调用链和实现",
      maxFiles: 5,
      maxChars: 9000,
    });
    expect(result.diagnostics.reasons[0]).toMatchObject({
      code: "inspect_intent",
    });
  });

  it("selects locate for fuzzy lookup intent", () => {
    const result = planContextRead({
      query: "帮我查找 context budget 相关文件",
      budget: { maxFiles: 6 },
    });

    expect(result.plan).toEqual({
      kind: "locate",
      query: "帮我查找 context budget 相关文件",
      maxFiles: 6,
    });
    expect(result.diagnostics.reasons[0]).toMatchObject({
      code: "fuzzy_lookup",
    });
  });

  it("normalizes budget values to deterministic minimums", () => {
    expect(
      normalizeContextReadBudget({
        maxFiles: 0,
        maxChars: -3,
        maxDepth: 1.7,
      }),
    ).toEqual({
      maxFiles: 1,
      maxChars: 1,
      maxDepth: 1,
    });
    expect(normalizeContextReadBudget()).toEqual(DEFAULT_CONTEXT_READ_BUDGET);
  });

  it("builder assembles the plan result with diagnostics and normalized budget", () => {
    const result = buildContextReadPlanResult({
      plan: {
        kind: "inspect",
        query: "review context module",
        maxFiles: 3,
        maxChars: 5000,
      },
      budget: {
        maxFiles: 0,
      },
      normalizedQuery: "review context module",
      reasons: [
        {
          code: "inspect_intent",
          message: "inspect requested",
        },
      ],
    });

    expect(result.budget.maxFiles).toBe(1);
    expect(result.diagnostics).toEqual({
      selectedKind: "inspect",
      normalizedQuery: "review context module",
      reasons: [
        {
          code: "inspect_intent",
          message: "inspect requested",
        },
      ],
    });
  });
});
