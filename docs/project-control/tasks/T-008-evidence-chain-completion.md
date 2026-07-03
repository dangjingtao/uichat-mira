---
status: current
priority: P1
owner: agent-remediation
last_verified: 2026-06-30
layer: project-control
module: ProjectControl
feature: EvidenceChainCompletion
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/chat/agent-phase-1-global-review.md
  - docs/chat/agent-phase-1-code-review.md
task_state: DONE
---

# T-008 Evidence Chain Completion

## Target

把工具回看与生成证据链从“只看最后一次工具结果”推进到正式 evidence payload。

问题本体：

- `routeStepNode` 当前更像机械回看开关
- `capabilityIntent` 回看时不直接消费工具结果
- `generateNode` 主要消费 `lastToolExecution`
- `observations` 能累积，但不是正式生成证据源

## Allowed Changes

- `routeStepNode`、`generateNode`、`retrieveNode`
- `AgentNodeState / AgentGraphOutput` 中与 observations/evidence 直接相关的实现
- 与回看、工具结果证据、生成输入直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 未经确认把该任务扩大成完整多工具 planner 重写
- 用口头约定替代正式 evidence payload
- 改动无关审批或终端语义

## Acceptance Criteria

1. `observations / toolExecutions` 成为正式 evidence payload，或等价正式证据输入
2. 生成层不再只依赖最后一次工具结果
3. 回看逻辑和生成逻辑的证据输入关系更清楚
4. 台账回填：
   - 对应 `GR-P1-4`
   - 对应原始评审点 `R20` `R21` `R22` `R23` `R29`

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server test -- src/agent/graph.test.ts src/agent/nodes.test.ts src/agent/resume.test.ts src/agent/routes.test.ts src/agent/persistence.test.ts`
  - 结果：通过，`5` 个测试文件、`33` 个测试通过
- `pnpm check`
  - 结果：通过

## Evidence

- Acceptance 1
  - [server/src/agent/types.ts](D:/workspace/rag-demo/server/src/agent/types.ts) 新增正式 `AgentEvidencePayload`，显式承载 `observations`、`toolExecutions`、`retrievals`
  - [server/src/agent/nodes.ts](D:/workspace/rag-demo/server/src/agent/nodes.ts) 的 `retrieveNode`、`toolNode`、`generateNode`、`evaluateNode` 已统一写入 evidence payload
  - [server/src/agent/nodes.test.ts](D:/workspace/rag-demo/server/src/agent/nodes.test.ts) 新增 retrieval evidence 断言

- Acceptance 2
  - [server/src/agent/nodes.ts](D:/workspace/rag-demo/server/src/agent/nodes.ts) 的 `buildGenerateMessages` / `buildGenerateInstructionMessages` 已改为优先消费 formal evidence payload
  - 生成输入现在会汇总已完成 `toolExecutions`，而不是只读 `lastToolExecution`
  - [server/src/agent/graph.test.ts](D:/workspace/rag-demo/server/src/agent/graph.test.ts) 覆盖了工具证据进入生成消息的断言

- Acceptance 3
  - [server/src/agent/nodes.ts](D:/workspace/rag-demo/server/src/agent/nodes.ts) 的 `routeStepNode` 已改为基于 evidence payload 中的 completed tool executions / retrievals / observations 判断回看条件
  - [server/src/agent/graph.ts](D:/workspace/rag-demo/server/src/agent/graph.ts) 已把 evidence 进入 graph state/output，回看与生成共享同一份正式证据输入
  - [server/src/agent/graph.test.ts](D:/workspace/rag-demo/server/src/agent/graph.test.ts) 保留并通过回看轮次相关断言，证明回看链路仍然成立

- Acceptance 4
  - 本卡已对齐 `GR-P1-4`
  - 本次实现覆盖的原始评审点：
    - `R20`：`routeStepNode` 不再只看机械开关
    - `R21`：回看阶段开始具备 evidence-aware 输入基础
    - `R22`：`generateNode` 不再只消费 `lastToolExecution`
    - `R23`：retrieval 结果进入正式 evidence payload，可与工具证据一起进入生成
    - `R29`：`observations` 从累积记录提升为正式 evidence 输入的一部分

## Changed Files

- `server/src/agent/types.ts`
- `server/src/agent/nodes.ts`
- `server/src/agent/graph.ts`
- `server/src/agent/graph.test.ts`
- `server/src/agent/nodes.test.ts`
- `server/src/agent/resume.test.ts`
- `server/src/agent/routes.test.ts`
- `server/src/agent/persistence.test.ts`

## Risks / Deferred

- 本次没有把 `capabilityIntentNode` 重写成直接消费结构化 evidence 的选择器；当前先完成“正式 evidence payload 收口 + route/generate 共用证据输入”
- `lastToolExecution` 仍保留为兼容字段，避免把本任务扩大成全链路字段替换
- 未触碰 forbidden area：未扩展为多工具 planner 重写，未改审批语义，未改终端语义

## Review Outcome

- 当前提交结论：评审通过
- 当前状态：`DONE`
- 评审结论：
  - `AC1` 已满足：`AgentEvidencePayload` 已成为正式证据载体，显式承载 `observations / toolExecutions / retrievals`
  - `AC2` 已满足：生成层已改为汇总已完成 `toolExecutions`，不再只依赖 `lastToolExecution`
  - `AC3` 已满足：`routeStepNode` 与生成层共享同一份 evidence 输入，回看关系比原先清楚
  - `AC4` 已满足：任务卡、测试和 workboard 对齐 `GR-P1-4` 与 `R20/R21/R22/R23/R29`
- 非阻断说明：
  - `capabilityIntentNode` 仍不是直接 evidence-aware selector，但这不在本卡 acceptance scope 内，保持为后续增强项
