---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-04
layer: project-control
module: ProjectControl
feature: WorkspacePathArgumentContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/agent_node_T009-evidence-summary-answer-stop-rule.md
  - docs/project-control/tasks/agent_node_T010-next-action-planner-json-contract-hardening.md
  - server/src/agent/next-action-planner.ts
  - server/src/agent/tool-call-normalize.ts
  - server/src/agent/tool-call-normalize.test.ts
  - server/src/agent/graph.test.ts
task_state: DONE
---

# agent_node_T011 workspace path argument contract

## Target

本任务只处理 workspace-bound read 工具的 path 参数契约，不扩成前端改造、Provider Gateway 改造、Harness 重写或 Agent Graph 大路由重构。

本任务目标：

1. 让 Agent 对 workspace-bound read 工具稳定使用 workspace-relative path
2. 让 `"/workspace"`、`"/README.md"`、`"/docs/README.md"` 这类模型常见输出不会再被误判为 workspace root 外
3. 保持 workspace 边界安全，不允许 `..` 越界、非当前 workspace 的 Windows 绝对路径或任意文件系统根路径绕过
4. 保持 `Normalize -> Policy -> ToolNode` 现有职责不变

## Allowed Changes

- `server/src/agent/next-action-planner.ts`
- `server/src/agent/tool-call-normalize.ts`
- `server/src/agent/tool-call-normalize.test.ts`
- `server/src/agent/graph.test.ts`
- `docs/project-control/tasks/agent_node_T011-workspace-path-argument-contract.md`
- `docs/project-control/agent-nodes-workboard.md`

本轮没有修改 `read runtime`。原因：当前真实 blocker 出现在 Planner 产出和 Policy 审批之间；在 `normalize` 单点规范化即可消除 `/workspace` 与 `/<file>` 的误判，同时不需要在 runtime 再做一层重复变换。

## Forbidden Changes

- `desktop` 前端
- trace UI
- Provider Gateway
- MCP registry
- ToolNode 大结构
- PolicyNode 大结构
- Agent Graph 大路由
- Repeated Tool Guard
- 长期记忆
- Agent V2 / DAG / 并发 / 多智能体

## Defect Layer

这次缺陷属于后端 agent contract defect，不是前端展示问题，也不是 Planner JSON 解析问题。

具体是：

- Planner 会产出类 Unix 根路径写法
- Policy / workspace-bound 安全校验按当前 workspace root 做判断
- 两边没有统一“workspace 根目录如何表达”的参数契约

影响面：

- `read_list`
- `read_open`
- 以及同类 `read` 域、`path` 入参、`workspaceBound=true` 的读取工具

## V1 / V1.5 Invariants

以下不变量保持不变：

1. Planner 只输出 `nextAction`
2. Normalize 只冻结 `pendingToolCall`
3. Policy 只审批 `pendingToolCall`
4. ToolNode 只执行 frozen `pendingToolCall`
5. `selectedToolId` 不是执行入口
6. `capabilityIntent.selectedToolIds` 不是执行入口
7. 绝对路径、越界路径与非当前 workspace 的 Windows 路径不能被静默放行
8. 非 read 工具参数不能被 path normalizer 改写

## Implementation Result

本次实现采用：

```txt
Planner prompt 明确契约
+
Normalize 单点规范化
+
Policy / runtime 安全边界保持不变
```

具体落地：

1. `next-action-planner.ts`
   - 明确告诉 task model：
     - workspace 根目录用 `.`
     - 不要输出 `/workspace`
     - 根目录文件不要写成 `/README.md`
     - 嵌套文件使用 `docs/README.md` 这类 workspace-relative path
2. `tool-call-normalize.ts`
   - 只在 `read` 域且 `workspaceBound=true` 且存在 `args.path` 时触发最小规范化
   - 已支持：
     - `read_list path "/workspace"` -> `.`
     - `read_open path "/README.md"` -> `README.md`
     - `read_open path "/docs/README.md"` -> `docs/README.md`
   - 明确拒绝：
     - `/workspace/../outside.txt`
     - 规范化后仍会逃出 workspace root 的路径
   - 明确不处理：
     - `terminal_session.command`
     - 非 read 工具参数
     - Windows 绝对路径的放行逻辑；它们继续交给既有 workspace 安全校验判断
3. 未修改 `server/src/mcp/read/runtime.ts`
   - 原因：避免 normalize 与 runtime 双重改写同一参数而互相打架

## Test Coverage

已补充并通过以下场景：

1. `read_list "/workspace"` 规范化为 `.`
2. `read_open "/README.md"` 规范化为 `README.md`
3. `read_open "/docs/README.md"` 规范化为 `docs/README.md`
4. 正常相对路径保持不变
5. `/workspace/../outside.txt` 在 normalize 阶段被拒绝
6. `D:\testData\x.txt` 保持原值，继续由下游 workspace 安全校验阻断
7. 非 read 工具 `terminal_session.command` 不被改写
8. Agent Graph 闭环中：
   - `"/workspace"` 不再卡在 approval，而是进入 `ToolNode`
   - `"/README.md"` 不再卡在 approval，而是进入 `ToolNode`

## Smoke Test

### Smoke Environment

- 时间：`2026-07-04`
- 鉴权：当前本地登录用户 `Tomz`
- workspace：先通过 `/mcp/workspace/select` 显式切到 `D:\workspace\rag-demo`
- 入口：对正在运行的本地后端发送真实 `/proxy/chat/default` agent 请求
- 线程：每条 smoke 独立新建线程，绑定 `T009 Smoke Workspace`

### Smoke 1

Input:

```txt
看看当前 workspace 有哪些文件
```

Observed:

- 不再失败于 `Planner output was invalid JSON`
- 不再停在 workspace path approval
- `firstPlannerAction = use_tool`
- 进入 `ToolNode`
- 写入 `agent-evidence-update-tool`
- 第二次 planner 命中 answer stop rule
- 进入 `generate` / `evaluate`
- 最终回答基于真实 `read_list` 结果，列出了 `D:\workspace\rag-demo` 根目录结构

### Smoke 2

Input:

```txt
打开 README.md 看看内容
```

Observed:

- 不再失败于 `Planner output was invalid JSON`
- 不再停在 workspace path approval
- `firstPlannerAction = use_tool`
- 进入 `ToolNode`
- 写入 `agent-evidence-update-tool`
- 第二次 planner 命中 answer stop rule
- 进入 `generate` / `evaluate`
- 最终回答基于真实 `README.md` 文件内容

### Smoke 3

Input:

```txt
看看 README.md 的内容
```

Observed:

- 不再失败于 `Planner output was invalid JSON`
- 不再停在 workspace path approval
- 当前实际走的是 `use_tool -> read_open`，而不是旧的 `retrieve -> web_search` 弯路
- 进入 `ToolNode`
- 写入 `agent-evidence-update-tool`
- 第二次 planner 命中 answer stop rule
- 进入 `generate` / `evaluate`
- 最终回答基于真实 `README.md` 文件内容

### Smoke 4

Input:

```txt
执行 dir 命令看看结果
```

Observed:

- 不再失败于 `Planner output was invalid JSON`
- 当前仍停在 approval
- 但 approval reason 已不是 workspace path
- approval reason:

```txt
terminal_session requires explicit approval before Agent execution.
```

- 未进入 `ToolNode`
- 未写入 evidence
- 未进入 `generate` / `evaluate`

结论：`terminal_session` 当前停在审批是既有高风险策略，不是 T011 的 workspace path defect。

## Changed Files

- `server/src/agent/next-action-planner.ts`
- `server/src/agent/tool-call-normalize.ts`
- `server/src/agent/tool-call-normalize.test.ts`
- `server/src/agent/graph.test.ts`
- `docs/project-control/tasks/agent_node_T011-workspace-path-argument-contract.md`
- `docs/project-control/agent-nodes-workboard.md`

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/agent/tool-call-normalize.test.ts`
  - 结果：通过，`24 passed`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/next-action-planner.test.ts`
  - 结果：通过，`29 passed`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/graph.test.ts src/agent/tool-call-normalize.test.ts`
  - 结果：通过，`41 passed`
- `pnpm check`
  - 结果：通过
- `pnpm package:electron:win`
  - 结果：命令返回成功，产物目录为 `release/v0.7.1_20260704_164241/electron`
  - 备注：打包日志夹带仓库现有前端 / server 非本任务测试失败输出；这些失败项不在 T011 改动范围内，而且打包脚本未因此中断
- 打包后健康检查
  - 命令：`curl http://127.0.0.1:8787/health`
  - 结果：通过，返回 `{"success":true,...}`

## Final Status

- `T011 = DONE`
- `T009 = READY_FOR_REVIEW`

## Notes

- 当前已确认 workspace path approval blocker 已解除
- `terminal_session` 的显式审批仍按既有安全策略生效，不计入 T011 缺陷
- 本轮没有引入 runtime fallback，也没有放松 workspace root 边界
