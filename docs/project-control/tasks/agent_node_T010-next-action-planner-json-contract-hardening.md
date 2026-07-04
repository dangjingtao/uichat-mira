---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: NextActionPlannerJsonContractHardening
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T009-evidence-summary-answer-stop-rule.md
  - server/src/agent/next-action-planner.ts
  - server/src/agent/next-action-planner.test.ts
task_state: DONE
---

# agent_node_T010 next action planner JSON contract hardening

## Target

本任务只处理 `nextActionPlannerNode` 的 JSON 决策契约加固，不扩成 Agent V2、Provider Gateway 重构、Harness 重写或前端任务。

本任务目标：

1. 让 `nextActionPlannerNode` 能从真实 task model 常见脏输出中稳定提取单一 JSON 决策
2. 在无法解析时输出可审计的 planner trace 诊断，而不是只有笼统的 invalid JSON
3. 保持 `Planner -> Normalize -> Policy -> ToolNode` 边界不变
4. 复跑 T009 前台 smoke，确认当前失败是否已经离开 planner invalid JSON

## Allowed Changes

- `server/src/agent/next-action-planner.ts`
- `server/src/agent/next-action-planner.test.ts`
- `docs/project-control/tasks/agent_node_T010-next-action-planner-json-contract-hardening.md`
- `docs/project-control/agent-nodes-workboard.md`

本轮没有修改 provider proxy。原因：先做解析层和诊断层加固，就能满足当前任务边界；`response_format` / `format: "json"` 仍可作为后续优化，但本轮没有安全必要性。

## Forbidden Changes

- `desktop` 前端
- trace UI / status mapping UI
- Harness 工具实现
- MCP registry
- Provider Gateway 大结构
- `ToolNode`
- `PolicyNode`
- `NormalizeNode`
- Agent Graph 大路由
- `Repeated Tool Guard`

## V1 / V1.5 Invariants

以下不变量保持不变：

1. Planner 只输出 `nextAction`
2. Normalize 只把 `nextAction.use_tool` 冻结成 `pendingToolCall`
3. Policy 只审批 `pendingToolCall`
4. ToolNode 只执行 `pendingToolCall`
5. `selectedToolId` 不得成为执行入口
6. `capabilityIntent.selectedToolIds` 不得直通 policy / tool
7. ToolNode 不得直接 answer
8. answer stop rule 仍依赖 `state.evidence.latestSummary`
9. invalid planner output 不得误判成 answer
10. 不得从自然语言猜测 `toolId` 或 `args`

## Implementation Result

本次实现已完成：

1. 在 `next-action-planner.ts` 中保留 `parseNextActionPlannerOutput(...)`，并新增内部诊断解析层：
   - 支持纯 JSON
   - 支持 fenced JSON
   - 支持中文前缀 + JSON
   - 支持 `<think>...</think>` + JSON
2. 解析策略改为：
   - 先 sanitization
   - 再提取 top-level JSON object 候选
   - 只有单一候选时才 `JSON.parse`
   - 多个 JSON object 时直接判 invalid，不猜
   - schema 非法时直接判 invalid，不猜
   - `ask_user` 继续按非法处理
3. trace details 已补充：
   - `rawOutputPreview`
   - `sanitizedOutputPreview`
   - `parseErrorReason`
   - `allowedActionTypes`
4. preview 已做截断，避免把完整原始输出全量塞入 trace
5. 没有修改 provider proxy，不把本任务扩大成跨 provider JSON mode 改造

## Test Coverage

`server/src/agent/next-action-planner.test.ts` 已补以下场景：

1. 纯 JSON 输出可解析
2. fenced JSON 输出可解析
3. 中文前缀 + JSON 输出可解析
4. `<think>...</think>` + JSON 输出可解析
5. 多个 JSON object 输出失败，不猜
6. `ask_user` 输出继续按非法处理
7. schema-invalid `use_tool.args` 继续失败
8. invalid JSON trace 包含 `rawOutputPreview / sanitizedOutputPreview / parseErrorReason / allowedActionTypes`
9. answer stop rule 命中时不调用 task model
10. iteration exhausted 时不调用 task model

## Manual Smoke Test

### Smoke 1: workspace file listing

Input:

```txt
看看当前 workspace 有哪些文件
```

Observed:

- result: `NO LONGER FAILING AT PLANNER PARSE`
- stage: 已离开 `nextActionPlanner` invalid JSON
- evidence source: `2026-07-04` 前台 black-box smoke test，运行时 workspace 已切到 `D:\workspace\rag-demo`
- notes:
  - Planner 接受缺失 `reason` 的 `use_tool read_list` 输出，并自动补 `reason`
  - planner trace 记录 `parseWarnings: ["missing_reason_defaulted"]`
  - 当前新停点为 `agent-approval`
  - approval reason: `read_list` 请求的 path 落在当前 workspace root 之外

### Smoke 2: README open

Input:

```txt
打开 README.md 看看内容
```

Observed:

- result: `NO LONGER FAILING AT PLANNER PARSE`
- notes:
  - Planner 接受缺失 `reason` 的 `use_tool read_open` 输出，并自动补 `reason`
  - planner trace 记录 `parseWarnings: ["missing_reason_defaulted"]`
  - 当前新停点为 `agent-approval`

### Smoke 3: README content

Input:

```txt
看看 README.md 的内容
```

Observed:

- result: `NO LONGER FAILING AT PLANNER PARSE`
- notes:
  - Planner 接受缺失 `reason` 的 `retrieve`
  - 后续又进入 `web_search`，并带 `missing_reason_defaulted` warning
  - 当前不再是 parser 失败，后续暴露的是回答内容 / 生成质量问题

### Smoke 4: terminal dir

Input:

```txt
执行 dir 命令看看结果
```

Observed:

- result: `NO LONGER FAILING AT PLANNER PARSE`
- notes:
  - Planner 接受缺失 `reason` 的 `use_tool terminal_session`，并自动补 `reason`
  - planner trace 记录 `parseWarnings: ["missing_reason_defaulted"]`
  - 当前新停点为 `agent-approval`

## Changed Files

- `server/src/agent/next-action-planner.ts`
- `server/src/agent/next-action-planner.test.ts`
- `docs/project-control/tasks/agent_node_T010-next-action-planner-json-contract-hardening.md`
- `docs/project-control/agent-nodes-workboard.md`

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/agent/next-action-planner.test.ts`
  - 结果：通过，`23 passed`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/next-action-planner.test.ts src/agent/graph.test.ts`
  - 结果：通过，`44 passed`
- `pnpm --filter @ui-chat-mira/server typecheck`
  - 结果：通过
- `pnpm check`
  - 结果：通过
- `pnpm package:electron:win`
  - 结果：命令返回成功，产物目录为 `release/v0.7.1_20260704_044848/electron`
  - 备注：打包日志内夹带仓库现有前端 / server 测试失败输出，但本次打包脚本未因此中断；本任务没有修改这些失败项
- 打包产物健康检查
  - 本轮未执行
  - 原因：本轮只完成打包，不在本回合内启动打包产物做 `/health` 验证
- 前台 black-box smoke test
  - 结果：已离开 `Planner output was invalid JSON`
  - 结论：
    - `read_list / read_open / terminal_session` 三条路径当前新停点为 `agent-approval`
    - `README` 内容查询路径当前已暴露后续回答内容 / 生成质量问题
    - `T010` 原始 blocker 已解除
    - 当前新 blocker 不是 Planner JSON contract，而是 workspace path argument contract / approval path 问题

## Final Status

- `T010 = DONE`
- `T009 = READY_FOR_REVIEW`

## Notes

- `Repeated Tool Guard` 本次未实现，也不是本次正式派发任务
- 不要把 workspace path / approval path 问题塞回 `T010`
- 后续建议新建 `agent_node_T011-workspace-path-argument-contract`
