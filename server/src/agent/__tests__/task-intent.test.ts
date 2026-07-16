import assert from "node:assert/strict";
import { test } from "vitest";
import { extractAgentRequiredWork } from "../task-intent";

test("extractAgentRequiredWork classifies locate intent for README.md", () => {
  const result = extractAgentRequiredWork({
    question: "README.md 在哪里？",
  });

  assert.equal(result.taskKind, "locate");
  assert.deepEqual(result.requiredActions, ["locate"]);
  assert.deepEqual(result.candidateTargets, ["README.md"]);
  assert.deepEqual(result.requiredTargets, []);
});

test("extractAgentRequiredWork classifies read_content intent separately from locate", () => {
  const result = extractAgentRequiredWork({
    question: "README.md 的内容是什么？",
  });

  assert.equal(result.taskKind, "read_content");
  assert.deepEqual(result.requiredActions, ["read_content"]);
  assert.deepEqual(result.candidateTargets, ["README.md"]);
  assert.deepEqual(result.requiredTargets, []);
});

test("extractAgentRequiredWork keeps multi-target order stable and deduplicated", () => {
  const result = extractAgentRequiredWork({
    question: "README.md 和 AGENTS.md 的内容分别是什么？README.md 也要看。",
  });

  assert.equal(result.taskKind, "read_content");
  assert.deepEqual(result.candidateTargets, ["README.md", "AGENTS.md"]);
  assert.deepEqual(result.requiredTargets, []);
});

test("extractAgentRequiredWork extracts mutation target from english path request", () => {
  const result = extractAgentRequiredWork({
    question: "删除 notes.txt",
  });

  assert.equal(result.taskKind, "mutate");
  assert.deepEqual(result.requiredActions, ["mutate"]);
  assert.deepEqual(result.candidateTargets, ["notes.txt"]);
  assert.deepEqual(result.requiredTargets, []);
});

test("extractAgentRequiredWork keeps verify as additional required action instead of replacing mutation", () => {
  const result = extractAgentRequiredWork({
    question: "写入 notes.txt 后验证内容是否正确",
  });

  assert.equal(result.taskKind, "mixed");
  assert.deepEqual(result.requiredActions, ["read_content", "mutate", "verify"]);
  assert.deepEqual(result.candidateTargets, ["notes.txt"]);
  assert.deepEqual(result.requiredTargets, []);
});

test("extractAgentRequiredWork splits Chinese bare mutation targets", () => {
  const result = extractAgentRequiredWork({
    question: "删掉如何被美丽女孩爱上和如何爱上美丽女孩",
  });

  assert.equal(result.taskKind, "mutate");
  assert.deepEqual(result.candidateTargets, [
    "如何被美丽女孩爱上",
    "如何爱上美丽女孩",
  ]);
});

test("extractAgentRequiredWork detects terminal intent", () => {
  const result = extractAgentRequiredWork({
    question: "执行 pnpm test",
  });

  assert.equal(result.taskKind, "terminal");
  assert.deepEqual(result.requiredActions, ["terminal"]);
  assert.deepEqual(result.requiredTargets, []);
});

test("extractAgentRequiredWork detects web search intent", () => {
  const result = extractAgentRequiredWork({
    question: "联网搜索最新 release notes",
  });

  assert.equal(result.taskKind, "search");
  assert.deepEqual(result.requiredActions, ["search"]);
});

test("extractAgentRequiredWork ignores /workspace as a standalone fake target and normalizes workspace-relative paths", () => {
  const result = extractAgentRequiredWork({
    question: "打开 /workspace/docs/README.md 看内容，不是 /workspace 根目录。",
  });

  assert.equal(result.taskKind, "read_content");
  assert.deepEqual(result.candidateTargets, ["/workspace/docs/README.md"]);
  assert.deepEqual(result.requiredTargets, []);
});

test("extractAgentRequiredWork can normalize absolute paths relative to workspaceRoot", () => {
  const result = extractAgentRequiredWork({
    question: "读取 D:\\workspace\\rag-demo\\README.md 的内容",
    workspaceRoot: "D:\\workspace\\rag-demo",
  });

  assert.equal(result.taskKind, "read_content");
  assert.deepEqual(result.candidateTargets, ["D:\\workspace\\rag-demo\\README.md"]);
  assert.deepEqual(result.requiredTargets, []);
});

test("extractAgentRequiredWork never turns POSIX absolute path into an execution target", () => {
  const result = extractAgentRequiredWork({
    question: "读取 /etc/passwd",
  });

  assert.deepEqual(result.candidateTargets, []);
  assert.deepEqual(result.requiredTargets, []);
});

test("extractAgentRequiredWork does not turn a directory description into a target", () => {
  const result = extractAgentRequiredWork({
    question: "在 server/src 下找 planner",
  });

  assert.deepEqual(result.candidateTargets, []);
  assert.deepEqual(result.requiredTargets, []);
});

test("extractAgentRequiredWork builds stable completion hints from currentTaskFrame without requiring workspaceRoot", () => {
  const result = extractAgentRequiredWork({
    question: "看看 README.md",
    currentTaskFrame: {
      currentGoal: "README.md 的内容是什么？",
      currentSubtask: "Read the file.",
      currentBlocker: undefined,
      confirmedObjects: [],
      completionCriteria: ["总结 README.md", "确认关键内容"],
    },
  });

  assert.deepEqual(result.completionHints, [
    "总结 README.md",
    "确认关键内容",
    "看看 README.md",
  ]);
});

test("only Planner-confirmed objects become required targets when locate has multiple candidates", () => {
  const result = extractAgentRequiredWork({
    question: "定位 README.md 和 AGENTS.md",
    currentTaskFrame: {
      currentGoal: "定位 README.md 和 AGENTS.md",
      currentSubtask: "Planner selected AGENTS.md from locate evidence.",
      currentBlocker: undefined,
      confirmedObjects: [
        {
          type: "file",
          id: "AGENTS.md",
          label: "AGENTS.md",
          confidence: 1,
          source: "planner",
        },
      ],
      completionCriteria: [],
    },
  });

  assert.deepEqual(result.candidateTargets, ["README.md", "AGENTS.md"]);
  assert.deepEqual(result.requiredTargets, ["agents.md"]);
});
