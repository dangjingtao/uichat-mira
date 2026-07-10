import assert from "node:assert/strict";
import { afterEach, test, vi } from "vitest";
import { contextBudgetService } from "@/services/context-budget/index";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import * as intentMatcherModule from "../intent/embedding-capability-matcher";
import { createToolExecutionEvidenceSummary } from "../evidence";
import { generateNode } from "../nodes/index";
import type { AgentNodeState } from "../node-runtime";

const baseGoal = {
  id: "goal-1",
  text: "answer the user",
  successCriteria: ["return an answer"],
  constraints: ["stay safe"],
  riskLevel: "low" as const,
};

const basePlan = {
  id: "plan-1",
  goalId: "goal-1",
  version: 1,
  steps: [],
};

const makeMessage = (content: string) => ({
  role: "user" as const,
  content,
  parts: [{ type: "text" as const, text: content }],
});
const createBaseState = (message: string): AgentNodeState => ({
  runId: "run-1",
  threadId: "thread-1",
  userId: 1,
  goal: { ...baseGoal, text: message },
  plan: basePlan,
  messages: [makeMessage(message)],
  observations: [],
  evidence: {
    observations: [],
    toolExecutions: [],
    retrievals: [],
  },
});

vi.spyOn(contextBudgetService, "pack").mockImplementation((input) => ({
  messages: [
    ...(input.sections.prefaceMessages ?? []),
    ...(input.sections.instructionMessages ?? []),
    ...((input.sections.payloads ?? []).flatMap((payload) => payload.messages)),
    ...(input.sections.historyMessages ?? []),
    input.sections.latestUserMessage,
  ],
  payloads: [],
  audit: {
    policy: input.policy,
    model: "test-model",
    providerCode: "test-provider",
    modelContextTokens: 8192,
    reservedOutputTokens: 1024,
    maxInputTokens: 7168,
    totalEstimatedTokensBefore: 0,
    totalEstimatedTokensAfter: 0,
    sections: [],
    warnings: [],
  },
}));

vi.spyOn(providerProxyService, "describeChatInvocation").mockImplementation(
  (_requestedProvider, messages) => ({
    operation: "chat",
    providerCode: "test-provider",
    requestedProvider: "default",
    resolvedProvider: "default",
    model: "test-model",
    modelConfigId: "test-model-config",
    messageCount: messages.length,
    messagesPreview: [],
  }),
);

afterEach(() => {
  vi.clearAllMocks();
});

test("createToolExecutionEvidenceSummary prioritizes documentation content over build artifacts for read_locate", () => {
  const summary = createToolExecutionEvidenceSummary({
    question: "请检索 workspace 中关于 UIChat Mira 的说明，然后基于检索结果回答 UIChat Mira 是什么。",
    execution: {
      toolId: "read_locate",
      args: { query: "UIChat Mira" },
      status: "completed",
      inputHash: "hash-read-locate",
      result: {
        type: "locate",
        scope: ".",
        query: "UIChat Mira",
        searchMode: "auto",
        matches: [
          {
            path: "release/v0.7.1_20260704_205127/electron/UIChat Mira Setup 0.7.1.exe",
            matchType: "path",
          },
          {
            path: "README.md",
            matchType: "content",
            line: 3,
            column: 1,
            preview: "UIChat Mira is a local-first desktop workspace for chat, knowledge, tools, and docs.",
          },
          {
            path: "AGENTS.md",
            matchType: "content",
            line: 5,
            column: 1,
            preview: "UIChat Mira is a local-first desktop workspace with an Electron shell, a React renderer, and a bundled Fastify backend.",
          },
        ],
      },
      startedAt: "2026-07-04T00:00:00.000Z",
      finishedAt: "2026-07-04T00:00:01.000Z",
    },
    evidenceIndex: 0,
  });

  assert.equal(summary?.data?.kind, "read_locate");
  assert.deepEqual(
    summary?.data?.matchesPreview.slice(0, 2).map((entry) => entry.includes("README.md") || entry.includes("AGENTS.md")),
    [true, true],
  );
  assert.equal(
    (summary?.data?.matchesPreview[0] ?? "").startsWith("[path] release/"),
    false,
  );
});

test("generateNode rewrites tool-style output into a natural read_list answer grounded in evidence", async () => {
  const state = createBaseState("看看当前 workspace 有哪些文件");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "read_list",
        args: { path: "." },
        status: "completed",
        inputHash: "hash-read-list",
        result: {
          type: "list",
          path: ".",
          entries: [],
        },
        summary: {
          source: "tool",
          status: "completed",
          toolId: "read_list",
          inputHash: "hash-read-list",
          actionTaken: "Listed workspace directory .",
          keyFindings: ["entryCount=3", "[F] README.md", "[D] docs"],
          answerReadiness: {
            canAnswer: true,
            reason: "Directory listing is sufficient for the user's workspace overview question.",
          },
          data: {
            kind: "read_list",
            path: ".",
            entryCount: 3,
            fileCount: 2,
            directoryCount: 1,
            entriesPreview: ["[F] README.md", "[D] docs", "[F] package.json"],
            truncated: false,
            canAnswerDirectoryQuestion: true,
          },
        },
        startedAt: "2026-07-04T00:00:00.000Z",
        finishedAt: "2026-07-04T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  const invokeSpy = vi
    .spyOn(providerProxyService, "generateTextForRole")
    .mockResolvedValue('<function_calls>{"toolId":"read_list"}</function_calls>');
  const executionEvents: Array<{
    nodeId: string;
    phase: string;
    details?: Record<string, unknown>;
  }> = [];

  const result = await generateNode(state, async (event) => {
    executionEvents.push({
      nodeId: event.nodeId,
      phase: event.phase,
      details:
        event.details && typeof event.details === "object"
          ? (event.details as Record<string, unknown>)
          : undefined,
    });
  });

  assert.equal(invokeSpy.mock.calls.length, 1);
  assert.match(result.answer ?? "", /README\.md/);
  assert.doesNotMatch(result.answer ?? "", /toolId|function_calls|pendingToolCall/i);
  const generateDoneEvent = executionEvents.find(
    (event) => event.nodeId === "agent-generate" && event.phase === "done",
  );
  assert.equal(generateDoneEvent?.details?.outputGuardTriggered, true);
});

test("generateNode rewrites pseudo-execution wording into a grounded read_open summary", async () => {
  const state = createBaseState("打开 README.md 看看内容");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "read_open",
        args: { path: "README.md" },
        status: "completed",
        inputHash: "hash-read-open",
        result: {},
        summary: {
          source: "tool",
          status: "completed",
          toolId: "read_open",
          inputHash: "hash-read-open",
          actionTaken: "Opened file README.md.",
          keyFindings: ["contentLength=42", "# UIChat Mira"],
          answerReadiness: {
            canAnswer: true,
            reason: "Opened file content is available for answer generation.",
          },
          data: {
            kind: "read_open",
            path: "README.md",
            contentPreview: "# UIChat Mira UIChat Mira is a local-first desktop workspace.",
            contentLength: 42,
            truncated: false,
            keySections: ["UIChat Mira"],
            canAnswerFileQuestion: true,
          },
        },
        startedAt: "2026-07-04T00:00:00.000Z",
        finishedAt: "2026-07-04T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    "我将调用 read_open 来打开 README.md。",
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /README\.md/);
  assert.match(result.answer ?? "", /UIChat Mira/);
  assert.doesNotMatch(result.answer ?? "", /我将调用|read_open/);
});

test("createToolExecutionEvidenceSummary marks applied edit_file replacement as a real mutation", () => {
  const summary = createToolExecutionEvidenceSummary({
    question: "把 notes.txt 里的 old 替换成 new",
    execution: {
      toolId: "edit_file",
      args: {
        path: "notes.txt",
        operation: "replace_block",
        expectedOldText: "old",
        newText: "new",
      },
      status: "completed",
      inputHash: "hash-edit-file-replace",
      result: {
        actionProfileId: "edit_replace_block",
        runtimeToolId: "edit_file",
        result: {
          path: "notes.txt",
          operation: "replace_block",
          dryRun: false,
          bytes: Buffer.byteLength("new", "utf-8"),
        },
      },
      startedAt: "2026-07-07T00:00:00.000Z",
      finishedAt: "2026-07-07T00:00:01.000Z",
    },
    evidenceIndex: 4,
  });

  assert.equal(summary.status, "completed");
  assert.equal(summary.data?.kind, "edit_file");
  if (summary.data?.kind === "edit_file") {
    assert.equal(summary.data.operation, "replace");
    assert.equal(summary.data.dryRun, false);
    assert.equal(summary.data.changed, true);
    assert.equal(summary.data.replaced, true);
    assert.equal(summary.data.actionProfileId, "edit_replace_block");
    assert.equal(summary.data.runtimeToolId, "edit_file");
  }
});

test("createToolExecutionEvidenceSummary maps workspace_mutation delete to completed mutation evidence", () => {
  const summary = createToolExecutionEvidenceSummary({
    question: "删除 notes.txt",
    execution: {
      toolId: "workspace_mutation",
      args: {
        operation: "delete",
        targetPath: "notes.txt",
      },
      status: "completed",
      inputHash: "hash-workspace-delete",
      result: {
        operation: "delete",
        targetPath: "notes.txt",
        dryRun: false,
        deletedType: "file",
        recursive: false,
      },
      startedAt: "2026-07-07T00:00:00.000Z",
      finishedAt: "2026-07-07T00:00:01.000Z",
    },
    evidenceIndex: 5,
  });

  assert.equal(summary.status, "completed");
  assert.equal(summary.data?.kind, "workspace_mutation");
  if (summary.data?.kind === "workspace_mutation") {
    assert.equal(summary.data.operation, "delete");
    assert.equal(summary.data.changed, true);
    assert.equal(summary.data.deleted, true);
    assert.equal(summary.data.dryRun, false);
  }
});

test("generateNode keeps read_list fallback at directory-overview scope when file content is still missing", async () => {
  const state = createBaseState("README.md 里写了什么？");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "read_list",
        args: { path: "." },
        status: "completed",
        inputHash: "hash-read-list-missing-content",
        result: {},
        summary: {
          source: "tool",
          status: "completed",
          toolId: "read_list",
          inputHash: "hash-read-list-missing-content",
          actionTaken: "Listed workspace directory .",
          keyFindings: ["entryCount=3", "[F] README.md", "[D] docs"],
          answerReadiness: {
            canAnswer: false,
            reason: "Directory listing alone does not satisfy a file-content question.",
            missingInfo: ["target file content or a narrower path"],
          },
          data: {
            kind: "read_list",
            path: ".",
            entryCount: 3,
            fileCount: 2,
            directoryCount: 1,
            entriesPreview: ["[F] README.md", "[D] docs", "[F] package.json"],
            truncated: false,
            canAnswerDirectoryQuestion: false,
          },
        },
        startedAt: "2026-07-04T00:00:00.000Z",
        finishedAt: "2026-07-04T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    "<function_calls>{\"toolId\":\"read_open\"}</function_calls>",
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /目录概览证据/);
  assert.match(result.answer ?? "", /README\.md/);
  assert.match(result.answer ?? "", /还不能回答文件内容问题/);
});

test("generateNode keeps edit_file dry-run fallback at preview scope instead of claiming the file changed", async () => {
  const state = createBaseState("把 notes.txt 改成新内容");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "edit_file",
        args: {
          path: "notes.txt",
          operation: "write_file",
          content: "replacement content",
        },
        status: "completed",
        inputHash: "hash-edit-dry-run-fallback",
        result: {
          path: "notes.txt",
          operation: "write_file",
          dryRun: true,
          bytes: Buffer.byteLength("replacement content", "utf-8"),
        },
        summary: createToolExecutionEvidenceSummary({
          question: "把 notes.txt 改成新内容",
          execution: {
            toolId: "edit_file",
            args: {
              path: "notes.txt",
              operation: "write_file",
              content: "replacement content",
            },
            status: "completed",
            inputHash: "hash-edit-dry-run-fallback",
            result: {
              path: "notes.txt",
              operation: "write_file",
              dryRun: true,
              bytes: Buffer.byteLength("replacement content", "utf-8"),
            },
            startedAt: "2026-07-07T00:00:00.000Z",
            finishedAt: "2026-07-07T00:00:01.000Z",
          },
          evidenceIndex: 6,
        }),
        startedAt: "2026-07-07T00:00:00.000Z",
        finishedAt: "2026-07-07T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    "<function_calls>{\"toolId\":\"edit_file\"}</function_calls>",
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /预览证据|还没有真实写入/);
  assert.doesNotMatch(result.answer ?? "", /已实际创建|已实际修改|已经修改/);
});

test("generateNode can summarize a real edit_file replacement after action profile mapping", async () => {
  const state = createBaseState("把 notes.txt 里的 old 替换成 new");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "edit_file",
        args: {
          path: "notes.txt",
          operation: "replace_block",
          expectedOldText: "old",
          newText: "new",
        },
        status: "completed",
        inputHash: "hash-edit-real-fallback",
        result: {
          actionProfileId: "edit_replace_block",
          runtimeToolId: "edit_file",
          result: {
            path: "notes.txt",
            operation: "replace_block",
            dryRun: false,
            bytes: Buffer.byteLength("new", "utf-8"),
          },
        },
        summary: createToolExecutionEvidenceSummary({
          question: "把 notes.txt 里的 old 替换成 new",
          execution: {
            toolId: "edit_file",
            args: {
              path: "notes.txt",
              operation: "replace_block",
              expectedOldText: "old",
              newText: "new",
            },
            status: "completed",
            inputHash: "hash-edit-real-fallback",
            result: {
              actionProfileId: "edit_replace_block",
              runtimeToolId: "edit_file",
              result: {
                path: "notes.txt",
                operation: "replace_block",
                dryRun: false,
                bytes: Buffer.byteLength("new", "utf-8"),
              },
            },
            startedAt: "2026-07-07T00:00:00.000Z",
            finishedAt: "2026-07-07T00:00:01.000Z",
          },
          evidenceIndex: 7,
        }),
        startedAt: "2026-07-07T00:00:00.000Z",
        finishedAt: "2026-07-07T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    "<function_calls>{\"toolId\":\"edit_file\"}</function_calls>",
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /已实际修改 notes\.txt|完成了指定内容替换/);
  assert.doesNotMatch(result.answer ?? "", /预览|还没有真实写入/);
});

test("generateNode refuses to pretend garbled terminal text was understood", async () => {
  const state = createBaseState("执行命令看看中文输出");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "terminal_session",
        args: { command: "Get-Content README.md" },
        status: "completed",
        inputHash: "hash-terminal-garbled",
        result: {},
        summary: {
          source: "tool",
          status: "blocked",
          toolId: "terminal_session",
          inputHash: "hash-terminal-garbled",
          actionTaken: 'Executed terminal command "Get-Content README.md".',
          keyFindings: ["stdout=锟斤拷锟斤拷", "stdoutEncoding=unknown"],
          answerReadiness: {
            canAnswer: false,
            reason: "Terminal output appears garbled, so the agent must not pretend it understood the text.",
            missingInfo: ["a readable terminal result"],
          },
          data: {
            kind: "terminal_session",
            command: "Get-Content README.md",
            exitCode: 0,
            processCompleted: true,
            commandSucceeded: "unknown",
            taskSatisfied: "unknown",
            stdoutPreview: "锟斤拷锟斤拷",
            stderrPreview: "",
            stdoutEncoding: "unknown",
            stderrEncoding: "utf8",
            timedOut: false,
            truncated: false,
            binaryDetected: false,
            violations: [],
            outputInterpretable: false,
            unreadableReason: "Terminal output appears garbled, so the agent must not pretend it understood the text.",
            canAnswerCommandQuestion: false,
          },
        },
        startedAt: "2026-07-04T00:00:00.000Z",
        finishedAt: "2026-07-04T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    "命令输出说明 README 主要在介绍 UIChat Mira。",
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /已执行完成/);
  assert.match(result.answer ?? "", /输出证据当前不可可靠解读|garbled|不可|不能|不可靠/);
  assert.doesNotMatch(result.answer ?? "", /README 主要在介绍 UIChat Mira/);
  assert.doesNotMatch(result.answer ?? "", /没有形成稳定完成结果/);
});

test("generateNode does not let non-zero exitCode terminal evidence be rewritten as task success", async () => {
  const state = createBaseState("执行 pnpm test 并告诉我结果");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "terminal_session",
        args: { command: "pnpm test" },
        status: "completed",
        inputHash: "hash-terminal-nonzero",
        result: {},
        summary: {
          source: "tool",
          status: "completed",
          toolId: "terminal_session",
          inputHash: "hash-terminal-nonzero",
          actionTaken: 'Executed terminal command "pnpm test".',
          keyFindings: [
            "exitCode=1",
            "processCompleted=true",
            "commandSucceeded=false",
            "taskSatisfied=unknown",
          ],
          answerReadiness: {
            canAnswer: true,
            reason:
              "Terminal command completed with a non-zero exit code, so the answer must describe command failure without claiming the task succeeded.",
          },
          data: {
            kind: "terminal_session",
            command: "pnpm test",
            exitCode: 1,
            processCompleted: true,
            commandSucceeded: "false",
            taskSatisfied: "unknown",
            stdoutPreview: "",
            stderrPreview: "missing script: test",
            stdoutEncoding: "utf8",
            stderrEncoding: "utf8",
            timedOut: false,
            truncated: false,
            binaryDetected: false,
            violations: [],
            outputInterpretable: true,
            canAnswerCommandQuestion: true,
          },
        },
        startedAt: "2026-07-04T00:00:00.000Z",
        finishedAt: "2026-07-04T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    "测试已通过，修复成功。",
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /退出码为 1|命令执行失败/);
  assert.match(result.answer ?? "", /不能直接下结论|任务目标/);
  assert.doesNotMatch(result.answer ?? "", /测试已通过|修复成功/);
});

test("generateNode strips bare tool id leakage from read_open completed evidence", async () => {
  const state = createBaseState("打开 README.md 看看内容");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "read_open",
        args: { path: "README.md" },
        status: "completed",
        inputHash: "hash-read-open",
        result: {},
        summary: {
          source: "tool",
          status: "completed",
          toolId: "read_open",
          inputHash: "hash-read-open",
          actionTaken: "Opened file README.md.",
          keyFindings: ["contentLength=42", "# UIChat Mira"],
          answerReadiness: {
            canAnswer: true,
            reason: "Opened file content is available for answer generation.",
          },
          data: {
            kind: "read_open",
            path: "README.md",
            contentPreview: "# UIChat Mira UIChat Mira is a local-first desktop workspace.",
            contentLength: 42,
            truncated: false,
            keySections: ["UIChat Mira"],
            canAnswerFileQuestion: true,
          },
        },
        startedAt: "2026-07-04T00:00:00.000Z",
        finishedAt: "2026-07-04T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue(
    "read_open completed, README.md says UIChat Mira is a local-first desktop workspace.",
  );

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /README\.md/);
  assert.match(result.answer ?? "", /UIChat Mira/);
  assert.doesNotMatch(result.answer ?? "", /read_open completed|read_open/);
});

test("generateNode returns deterministic fallback when model answer is empty but completed evidence exists", async () => {
  const state = createBaseState("打开 README.md 看看内容");
  state.evidence = {
    observations: [],
    toolExecutions: [
      {
        toolId: "read_open",
        args: { path: "README.md" },
        status: "completed",
        inputHash: "hash-read-open",
        result: {},
        summary: {
          source: "tool",
          status: "completed",
          toolId: "read_open",
          inputHash: "hash-read-open",
          actionTaken: "Opened file README.md.",
          keyFindings: ["contentLength=42", "# UIChat Mira"],
          answerReadiness: {
            canAnswer: true,
            reason: "Opened file content is available for answer generation.",
          },
          data: {
            kind: "read_open",
            path: "README.md",
            contentPreview: "# UIChat Mira UIChat Mira is a local-first desktop workspace.",
            contentLength: 42,
            truncated: false,
            keySections: ["UIChat Mira"],
            canAnswerFileQuestion: true,
          },
        },
        startedAt: "2026-07-04T00:00:00.000Z",
        finishedAt: "2026-07-04T00:00:01.000Z",
      },
    ],
    retrievals: [],
  };
  state.evidence.latestSummary = state.evidence.toolExecutions[0]?.summary;

  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue("");

  const result = await generateNode(state);

  assert.match(result.answer ?? "", /模型没有生成有效回答/);
  assert.match(result.answer ?? "", /README\.md/);
  assert.equal(result.generatedAnswerEmptyFallback, true);
  assert.equal(result.errorMessage, undefined);
});

test("generateNode returns deterministic fallback when model answer is empty and no evidence exists", async () => {
  const state = createBaseState("README.md 的 Runtime 一节具体列了哪些运行组件？");
  vi.spyOn(providerProxyService, "generateTextForRole").mockResolvedValue("");

  const result = await generateNode(state);

  assert.equal(
    result.answer,
    "模型没有生成有效回答，而且当前也没有可用证据可供总结。",
  );
  assert.equal(result.generatedAnswerEmptyFallback, true);
  assert.equal(result.errorMessage, undefined);
});

test("generateNode returns schema-safe fallback without calling the model after bounded replan is exhausted", async () => {
  const state = createBaseState("README.md 的 Runtime 一节具体列了哪些运行组件？请基于文件内容回答。");
  state.schemaReplanDiagnostics = {
    schemaError: "args.limit is not allowed",
    toolId: "read_open",
    invalidAction: {
      type: "use_tool",
      toolId: "read_open",
      args: {
        path: "README.md",
        limit: 3,
      },
      reason: "Need file content.",
    },
    attemptCount: 2,
  };
  const invokeSpy = vi.spyOn(providerProxyService, "generateTextForRole");

  const result = await generateNode(state);

  assert.equal(invokeSpy.mock.calls.length, 0);
  assert.match(result.answer ?? "", /工具参数不符合要求/);
  assert.match(result.answer ?? "", /args\.limit is not allowed/);
  assert.equal(result.errorMessage, undefined);
});
