---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphVerificationBridge
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/reviews/code_T011-codegraph-verification-bridge-review.md
  - docs/project-control/tasks/code_T010-codebase-explore-wrapper-runtime.md
task_state: DONE
---

# code_T011 CodeGraph Verification Bridge

## Target

实现 CodeGraph candidate 到原文核验的 Verification Bridge，串接 `followUpReads` 与 `read_file_slice` 或等价原文读取能力，建立 `candidate -> verified evidence input` 的受控过渡。

本任务允许建立候选事实池到 verified Evidence input 的桥，但：

- 不让 Planner 默认使用 CodeGraph
- 不让未核验 candidate 进入 Evidence
- 不改变 Generate 的最终回答规则

## Allowed Changes

- `docs/project-control/tasks/code_T011-codegraph-verification-bridge.md`
- `docs/project-control/reviews/code_T011-codegraph-verification-bridge-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/**`
- 相关测试文件

## Forbidden Changes

- Planner 暴露面
- Agent Graph routing
- Policy / ToolNode 主链
- Generate 行为
- 默认启用 CodeGraph
- 未核验 candidate 进入 Evidence
- `desktop/src/**`
- `electron/**`
- `packages/**`
- `package.json`
- `pnpm-lock.yaml`

## Acceptance Criteria

1. 定义 candidate verification 输入输出合同。
2. 将 `CodebaseExploreResult.followUpReads` 转换为 `read_file_slice` 请求计划。
3. 执行等价原文读取能力核验候选原文。
4. 生成 verified result，包含：
   - verified path
   - verified line range
   - minimal excerpt
   - verified summary
   - provider trace pointer
   - mismatch notes
5. 处理 rejected / unverifiable candidate。
6. provider summary 与原文不一致时：
   - 标记 mismatch
   - 不静默覆盖
   - 不作为事实进入 Evidence
7. 保留 Evidence gate：
   - candidate 先进入候选事实池
   - verified 后才可作为 Evidence input
8. 所有 CodeGraph candidate 必须先核验。
9. 未核验 candidate 不得进入 Evidence。
10. 核验失败必须可见，不得静默丢弃。
11. `read_file_slice` / 原文读取失败时 candidate 标记 `rejected` 或 `unverifiable`。
12. 不改变 Generate 的最终回答规则。
13. 不默认暴露给 Planner。
14. 不执行 CodeGraph broad explore 裸结果入 Evidence。

## Completion Evidence

### Changed Files

- `docs/project-control/tasks/code_T011-codegraph-verification-bridge.md`
- `docs/project-control/reviews/code_T011-codegraph-verification-bridge-review.md`
- `docs/project-control/project-control-ledger.md`
- `server/src/mcp/managed-codegraph/codebase-explore-wrapper.ts`
- `server/src/mcp/managed-codegraph/codegraph-verification-bridge.ts`
- `server/src/mcp/managed-codegraph/index.ts`
- `server/src/mcp/managed-codegraph/types.ts`
- `server/src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`

### Diff Summary

- 在 wrapper 结果中新增 `followUpReads`，把候选核验计划显式化，固定为 `read_file_slice` 语义。
- 新增 `codegraph-verification-bridge.ts`，执行 workspace 边界校验、原文读取、行窗口切片、summary mismatch 检测，以及 `verified / rejected / unverifiable` 三类输出。
- 新增 verified evidence input 适配器，只把 verified 子集转换为 `AgentRetrievalEvidence` 兼容输入，拒绝把未核验或核验失败的 candidate 混入后续输入。
- 扩展定向测试，覆盖 valid path/line、no line range、path denied、missing file、summary mismatch、verified subset only、rejected 可见性，以及不接 Planner/Generate 主链。

### Acceptance Criteria Evidence

- AC1：`server/src/mcp/managed-codegraph/types.ts` 已新增 `CodebaseVerificationResult`、`CodebaseVerifiedCandidate`、`CodebaseVerifiedEvidenceInput` 等合同。
- AC2：`server/src/mcp/managed-codegraph/codebase-explore-wrapper.ts` 输出 `followUpReads`，每条计划固定 `toolId = read_file_slice`。
- AC3：`server/src/mcp/managed-codegraph/codegraph-verification-bridge.ts` 使用 workspace 边界校验 + 原文读取 + `sliceExtractedText()` 做原文核验。
- AC4：verified 结果统一包含 `verifiedPath`、`verifiedStartLine / verifiedEndLine`、`minimalExcerpt`、`verifiedSummary`、`providerTracePointer`、`mismatchNotes`。
- AC5：bridge 会把失败结果保留在 `rejected` / `unverifiable` 集合，不静默丢弃；测试覆盖。
- AC6：summary token 与 verified excerpt 完全不匹配时会记录 `provider_summary_mismatch`，并进入 `rejected`；测试覆盖。
- AC7-10：`verifiedEvidenceInput` 与 `toAgentRetrievalEvidenceFromVerification()` 只消费 `verified` 子集，`rejected / unverifiable` 不进入后续输入；测试覆盖。
- AC11：path denied、missing file、no line range 都会明确落到 `rejected` 或 `unverifiable`；测试覆盖。
- AC12：没有修改 `server/src/agent/nodes/generate.ts` 或 Generate 规则；隔离测试断言未 import generate。
- AC13：没有修改 Planner 暴露面；隔离测试断言未 import planner。
- AC14：broad explore 仍要先经过 T010 wrapper 裁剪和本次核验，不能裸入 Evidence；verified adapter 仅接受 verified 子集。

## Verification Results

- `pnpm --dir server test -- src/mcp/managed-codegraph/__tests__/managed-codegraph-process-manager.test.ts`
  - 结果：通过，1 个测试文件，31 个测试通过
- `pnpm --dir server typecheck`
  - 结果：被任务外现有错误阻断
  - 阻断位置：
    - `server/src/routes/microapps/index.ts:321` `SocketStream.close` 不存在
    - `server/src/routes/microapps/index.ts:327` `SocketStream.send` 不存在
    - `server/src/routes/microapps/index.ts:358` `SocketStream.close` 不存在
    - `server/src/routes/microapps/index.ts:376` `SocketStream.close` 不存在
- `pnpm check`
  - 结果：被同一组任务外 `microapps` typecheck 错误阻断

## Scope Declaration

- 未修改 Planner 暴露面
- 未修改 Agent Graph routing
- 未修改 Policy / ToolNode 主链
- 未修改 Generate 行为
- 未让未核验 candidate 进入 Evidence
- 未修改 `desktop/src/**`、`electron/**`、`packages/**`
- 未修改 `package.json`
- 未修改 `pnpm-lock.yaml`
- 未修改 `server/src/agent/evidence.ts` 主实现
