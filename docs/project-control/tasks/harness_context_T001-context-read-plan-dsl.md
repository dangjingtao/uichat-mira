---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-05
layer: project-control
module: Harness
feature: ContextReadPlanDsl
doc_type: task-card
canonical: true
related:
  - docs/harness/README.md
  - docs/tooling-runtime/read-skill-design.md
  - server/src/harness/context/index.ts
  - server/src/harness/context/planner.test.ts
task_state: READY_FOR_REVIEW
---

# harness_context_T001 Context Read Plan DSL MVP

## Target

为 `Harness Context System` 建立最小 `Context Read Plan DSL`。

问题本体：

- 当前大范围读取仍容易退化为 Planner 猜工具
- Context System 需要先回答“怎么读”，而不是直接把实现细节压给模型
- 第一版先把 deterministic planner、budget、plan result 和 diagnostics 立住，不引入 LSP 或全仓语义理解

## Allowed Changes

- `server/src/harness/context/**`
- 与本任务直接相关的 `server` 测试
- 与本任务直接相关的当前项目台账文档

## Forbidden Changes

- `read_*` 工具实现
- LSP / tree-sitter 接入
- 全仓语义理解链路
- `desktop/`
- `electron/`
- `pnpm-lock.yaml`

## Acceptance Criteria

1. 新增 `plan / result / diagnostics` 类型
2. 新增 budget：`maxFiles / maxChars / maxDepth`
3. planner 是确定性的：
   - 明确路径 -> `open`
   - 目录意图 -> `list`
   - 模糊文件或关键词 -> `locate`
   - 检查或理解模块 -> `inspect`
4. builder 先能组装最小 plan result
5. diagnostics 记录为什么选这个 plan
6. 台账记录这次任务

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/harness/context/planner.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`1` file, `6` tests)
- `pnpm --filter @ui-chat-mira/server exec tsc --noEmit -p tsconfig.json`
  - workdir: `D:/workspace/rag-demo`
  - result: failed outside this task's modified scope
  - failure:
    - `src/sandbox/executor.ts(4,42)` 缺少 `mime-types` 声明文件
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - result: failed outside this task's modified scope
  - failure:
    - `server typecheck` 被 `src/sandbox/executor.ts(4,42)` 的 `mime-types` 类型缺口阻断

## Evidence

- Changed files:
  - `server/src/harness/context/contract.ts`
  - `server/src/harness/context/budget.ts`
  - `server/src/harness/context/diagnostics.ts`
  - `server/src/harness/context/builder.ts`
  - `server/src/harness/context/planner.ts`
  - `server/src/harness/context/index.ts`
  - `server/src/harness/context/planner.test.ts`
  - `docs/project-control/tasks/harness_context_T001-context-read-plan-dsl.md`
  - `docs/project-control/project-control-ledger.md`
- Current implementation evidence:
  - `ContextReadPlan` DSL 已覆盖 `list / open / locate / inspect`
  - budget 已统一归一化为 `maxFiles / maxChars / maxDepth`
  - planner 已按路径、目录意图、inspect 意图、模糊定位做确定性分流
  - builder 当前只组装 `plan + budget + diagnostics`
  - diagnostics 会记录选型原因和推断路径
  - 定向回归 `server/src/harness/context/planner.test.ts` 已覆盖：
    - 明确文件路径 -> `open`
    - 目录意图 -> `list`
    - 模块理解意图 -> `inspect`
    - 模糊查找 -> `locate`
    - budget 归一化
    - builder 结果组装

## Unfinished / Risks

- 这次只完成 Context Read Plan DSL MVP，没有接入实际 `read_*` 执行链
- 如果后续要把 planner 结果接进 Agent 或 Harness 主链，需要单独任务定义协议边界
- `server` 包现有 typecheck 和 `pnpm check` 被 `src/sandbox/executor.ts` 的 `mime-types` 类型缺口阻断，这不是本任务改动引入的问题

## Review Outcome

- 评审结论：待复评
- 当前状态：`READY_FOR_REVIEW`
