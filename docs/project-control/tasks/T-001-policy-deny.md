---
status: current
priority: P1-high
owner: agent-remediation
last_verified: 2026-06-30
layer: project-control
module: ProjectControl
feature: PolicyDeny
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/chat/agent-phase-1-global-review.md
  - docs/chat/agent-phase-1-code-review.md
task_state: DONE
---

# T-001 Policy Deny

## Target

收敛 `policyNode` 对 `deny` 分支的类型契约隐患。

这张卡不再属于 `P0` 已知必现风险，而是本轮安全整改中需要一并修掉的 `P1-high` 项。

问题本体：

- `AgentPolicyDecision` 类型里有 `deny`
- 当前 `policyNode` 仍使用“不是 `require_approval` 就执行”的写法
- 当前本地实现里 `evaluateAgentToolPolicy` 还没有实际返回 `deny`

所以它是明确的安全隐患，但不是当前已知已经触发的放行故障。

## Allowed Changes

- `policyNode`、`policy.ts`、相关类型定义
- 与 `allow / require_approval / deny` 分支直接相关的测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 把本任务扩大成审批系统重构
- 借修复名义引入兼容分支或静默 fallback
- 与本任务无关的 runtime boundary 调整

## Acceptance Criteria

1. `policyNode` 显式处理：
   - `allow`
   - `require_approval`
   - `deny`
2. 不再存在“不是 `require_approval` 就执行”的宽松放行逻辑
3. 本地测试或最小验证能证明：
   - `allow` 会执行
   - `require_approval` 会进入审批
   - `deny` 会阻断执行
4. 台账回填：
   - 对应 `GR-P1-HIGH`
   - 对应原始评审点 `R12`

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/agent/policy.test.ts`
  - 结果：`src/agent/policy.test.ts` 通过，`8` 个测试全部通过
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过，无报错

## Evidence

- `policyNode` 已显式区分 `allow / deny / require_approval` 三类决策，不再使用“不是 `require_approval` 就执行”的宽松放行逻辑。
- `deny` 分支会直接阻断执行，不创建 `pendingToolCall`，也不进入 `pendingApproval`。
- `policy.test.ts` 已覆盖：
  - `allow` 会进入执行准备
  - `require_approval` 会进入审批
  - `deny` 会阻断执行
- 本任务对应：
  - 台账项 `GR-P1-HIGH`
  - 原始评审点 `R12`
