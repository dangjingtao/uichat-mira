---
status: current
priority: P2
owner: agent-runtime
last_verified: 2026-07-07
layer: project-control
module: AgentRuntime
feature: CoreToolSummaryContracts
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/tooling-runtime/agent-runtime-t29-t33-ledger.md
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - server/src/agent/evidence.ts
task_state: DONE
---

# agent_node_T033 Core Tool Summary Contracts

## Target

补齐核心工具 `AgentEvidenceSummary` contract，重点覆盖 `edit_file`、workspace mutation 类工具，以及 action profile 映射后的真实 runtime tool 结果。

本任务只补核心工具 summary contract，不做大规模工具体系重构。

## Source Task Pack

- External task id: `T33`
- External title: `核心工具 summary contract`

## Allowed Changes

- `server/src/agent/evidence.ts`
- edit 或 workspace mutation runtime tool result shape
- action profile 映射逻辑
- generate fallback summary
- 相关最小单测

## Forbidden Changes

- 不放宽 unknown completed tool 的安全 fallback
- 不把所有工具都默认 `canAnswer=true`
- 不重写 action profile 系统
- 不重写 `edit_file` 工具
- 不新增大规模黑盒
- 不改变 Agent Graph 主链

## Suggested Summary Data

```ts
{
  kind: "workspace_mutation" | "edit_file" | "action_profile";
  operation: "create" | "overwrite" | "replace" | "delete" | "unknown";
  targetPath?: string;
  dryRun?: boolean;
  changed?: boolean;
  created?: boolean;
  replaced?: boolean;
  deleted?: boolean;
  runtimeToolId?: string;
  actionProfileId?: string;
  canAnswerMutationQuestion: boolean;
}
```

## Acceptance Criteria

1. `dryRun=true` 时，只能回答预览或计划，不能说文件已经修改。
2. edit success 且 `dryRun=false` 时，可以说明已创建、已修改或已替换目标文件。
3. edit failure 不会被当成 completed mutation summary。
4. action profile 映射到 `edit_file` 后，summary 能说明真实 runtime tool 结果。
5. 有最小测试覆盖 `dryRun` 与真实写入差异。

## Verification

- 运行 `edit_file` summary、workspace mutation summary、action profile summary 相关的最小测试集。
- 核对 dry-run 和真实写入在 generate 层的表达差异。

## Review Evidence

- `server/src/agent/evidence.ts` 已为 `edit_file` 与 `workspace_mutation` 增加稳定 summary builder，区分 `operation / dryRun / changed / created / replaced / deleted / runtimeToolId / actionProfileId`。
- `dryRun=true` 时，summary 与 generate fallback 都保持预览语义，不会说成已实际写入或已实际执行。
- `edit_file` / `workspace_mutation` 的失败不会进入 completed mutation summary；unknown completed tool fallback 仍保持 `canAnswer=false` 和 “summary contract 尚不稳定”的安全口径。
- action profile 映射后的结果会保留 `actionProfileId` 与 `runtimeToolId`，generate 可按真实 runtime tool 结果给出可读摘要。
- `2026-07-08` 复核通过的定向验证：
  - `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/nodes.test.ts src/harness/action-profiles.test.ts src/mcp/tools/edit-file.tool.test.ts`
