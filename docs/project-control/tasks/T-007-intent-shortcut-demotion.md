---
status: current
priority: P1
owner: agent-remediation
last_verified: 2026-06-30
layer: project-control
module: ProjectControl
feature: IntentShortcutDemotion
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/chat/agent-phase-1-global-review.md
  - docs/chat/agent-phase-1-code-review.md
task_state: DONE
---

# T-007 Intent Shortcut Demotion

## Target

降低规则短路强度，让规则回到召回增强角色，而不是提前替代能力选择。

问题本体：

- `computeRuleScore` 适合做召回增强，不适合做强决策
- `isWorkspaceIntentQuery` 当前属于强路由 gate
- 当前 task model 输入结构也存在被规则分数和历史消息干扰的风险

## Allowed Changes

- `embedding-capability-matcher.ts`
- `capability-diagnostics.ts`
- `task-capability-selector.ts`
- 与意图识别短路、候选选择、解析约束直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 直接把意图识别变成纯硬编码规则
- 直接把意图识别变成无约束自由选工具
- 未经确认扩大到完整 planner 重做

## Acceptance Criteria

1. workspace rule 从 hard shortcut 降级为 hint / score 型信号，或至少显著收紧触发条件
2. task model 在能力选择层保持最终意图裁决权
3. 安全放行仍明确由 `policy / approval / runtime` 负责
4. 台账回填：
   - 对应 `GR-P1-3`
   - 对应原始评审点 `R01` `R02` `R03` `R04` `R05` `R06`

## Verification

- `pnpm test -- src/agent/intent/task-capability-selector.test.ts src/agent/intent/embedding-capability-matcher.test.ts src/mcp/harness/capability-diagnostics.test.ts`
  - workdir: `server/`
  - result: passed (`3` files, `12` tests)
- `pnpm typecheck`
  - workdir: `server/`
  - result: failed outside this task's modified scope
  - failure: `src/agent/graph.ts(320,5): error TS2741: Property 'evidence' is missing ... but required in type 'AgentGraphOutput'.`

## Evidence

- Changed files:
  - `server/src/agent/intent/task-capability-selector.ts`
  - `server/src/agent/intent/task-capability-selector.test.ts`
- Diff summary:
  - Removed the workspace-intent hard shortcut so workspace/file wording no longer returns a rule-selected capability before task-model review.
  - Replaced the old workspace gate with a workspace hint message that is passed to the task model as non-binding context.
  - Strengthened task-model prompting so scores, rule hints, and message history are explicitly described as auxiliary signals rather than routing authority.
  - Expanded candidate prompt fields to include `finalScore` and `rerankScore`, reducing ambiguity around which score the task model is seeing.
  - Tightened selection parsing so `use_capability` must include a non-empty `capabilityId`, otherwise the payload is treated as invalid.
  - Updated direct selector tests to lock in the new behavior and parser contract.
- Acceptance criteria evidence:
  - AC1: `selectCapabilityWithTaskModel` no longer returns early on `isWorkspaceIntentQuery`; workspace wording is downgraded to `buildWorkspaceIntentHint(...)` and sent as prompt context only.
  - AC2: Selector decisions now always pass through the task model when candidates exist, including workspace-folder requests covered by `task-capability-selector.test.ts`.
  - AC3: No `policy`, `approval`, or runtime execution files were modified; this task stays within the capability-selection layer.
  - AC4: This task addresses `GR-P1-3` and the raw review points:
    - `R01`: rule score remains a hint, not final routing authority
    - `R02`: workspace shortcut/gate removed from direct selection path
    - `R03`: read-capability preference is no longer used as a pre-task-model selector
    - `R04`: read tool routing remains scoped to `resolveSelectedToolIds`, after capability selection
    - `R05`: task-model input now includes clearer candidate scores and safer history framing
    - `R06`: `use_capability` without `capabilityId` is rejected at parse time

## Unfinished / Risks

- `pnpm typecheck` is currently blocked by a pre-existing `AgentGraphOutput.evidence` type mismatch in `server/src/agent/graph.ts`, which is outside the allowed change scope for `T-007`.
- `pnpm check` and packaging commands were not run for this task package because the task only changes backend intent-selection behavior and the workspace currently has extensive unrelated modifications.

## Review Outcome

- 评审结论：通过
- 当前状态：`DONE`
- 结论依据：
  - workspace 规则已从强短路降级为 task-model 辅助提示
  - task model 保留最终能力裁决权
  - 解析契约已收紧，避免 `use_capability` 的脏成功态
- 对应实现证据：
  - [server/src/agent/intent/task-capability-selector.ts](D:/workspace/rag-demo/server/src/agent/intent/task-capability-selector.ts:67)
  - [server/src/agent/intent/node.ts](D:/workspace/rag-demo/server/src/agent/intent/node.ts:37)
  - [server/src/agent/intent/task-capability-selector.test.ts](D:/workspace/rag-demo/server/src/agent/intent/task-capability-selector.test.ts:108)
