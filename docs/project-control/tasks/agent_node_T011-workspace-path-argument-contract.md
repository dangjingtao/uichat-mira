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
  - server/src/agent/tool-call-normalize.ts
  - server/src/agent/tool-call-normalize.test.ts
task_state: DONE
---

# agent_node_T011 workspace path argument contract

## Target

本任务只修 `server/src/agent/tool-call-normalize.ts` 中 workspace-bound read path normalizer 过宽的问题，不扩成前端改造、Provider Gateway 改造、Agent Graph 重构或 runtime 边界改造。

当前 blocker 很具体：

- 旧逻辑会把所有 `/xxx` 都直接改成 `xxx`
- 这会把 `/etc/passwd` 静默改写成 `etc/passwd`
- 这违反 T011 的 workspace 安全边界

## Allowed Changes

- `server/src/agent/tool-call-normalize.ts`
- `server/src/agent/tool-call-normalize.test.ts`
- `docs/project-control/tasks/agent_node_T011-workspace-path-argument-contract.md`
- `docs/project-control/agent-nodes-workboard.md`
- 如需补最小 graph 定向回归，最多可触达 `server/src/agent/graph.test.ts`

## Forbidden Changes

- `server/src/agent/tool-node.ts`
- `server/src/agent/policy-node.ts`
- `server/src/agent/graph.ts`
- `server/src/mcp/read/runtime.ts`
- `server/src/mcp/workspace.ts`
- `desktop/**`
- Provider Gateway
- MCP registry
- Agent V2 / DAG / 并发 / 多智能体 / 长期记忆

## Defect Layer

这次缺陷属于后端 agent contract defect，位置在 `Normalize -> Policy` 之间，不是前端问题，也不是 ToolNode 执行问题。

具体原因：

- workspace-bound read 工具允许 planner 产出 root-relative path
- normalize 把所有 `/xxx` 都当成项目内相对路径处理
- 系统绝对路径因此可能被伪装成 workspace-relative path

## Invariants

以下行为必须保持：

1. Normalize 只冻结 `pendingToolCall`
2. Normalize 不执行工具，也不审批工具
3. PolicyNode 只审批 frozen `pendingToolCall`
4. ToolNode 只执行 frozen `pendingToolCall`
5. `selectedToolId` 不是执行入口
6. `capabilityIntent.selectedToolIds` 不是执行入口
7. `terminal_session.command` 不被 path normalizer 改写
8. 非 read 工具不受本次 path normalizer 影响

## Implementation Result

本次实现把 root-relative read path normalizer 进一步收紧到只识别 workspace sentinel，保持 `Normalize -> Policy -> ToolNode` 现有职责不变。

具体结果：

1. workspace sentinel 继续允许：
   - `/workspace` -> `.`
   - `/workspace/` -> `.`
   - `/workspace/<safe-relative-path>` -> `<safe-relative-path>`
2. 普通 root-relative path 不再被 normalize 阶段静默改写
3. `/etc/passwd` 不会被 normalize 成 `etc/passwd`
4. `/README.md`、`/docs/README.md` 也不再在 normalize 阶段自动改成相对路径
5. `../outside.txt` 与 `/workspace/../outside.txt` 仍会因为越出 workspace 边界而被拒绝
6. `README.md`、`docs/README.md` 继续保持原值
7. `D:\workspace\rag-demo\README.md` 这类 Windows 绝对路径仍不在 normalize 阶段静默改写，继续交给下游 workspace root 校验

## Test Coverage

T011 的安全边界已补测，当前定向测试覆盖至少包含：

1. `/workspace` -> `.`
2. `/workspace/` -> `.`
3. `/README.md` 保持原值，继续交给下游 workspace root 校验
4. `/docs/README.md` 保持原值，继续交给下游 workspace root 校验
5. `README.md` 保持原值
6. `../outside.txt` 被拒绝
7. `/workspace/../outside.txt` 被拒绝
8. `/etc/passwd` 保持原值，不会被 normalize 成 `etc/passwd`
9. `/bin/sh` 保持原值
10. `/usr/bin/env` 保持原值
11. `/C:/Windows/System32` 保持原值
12. `D:\testData\x.txt` 保持原值，继续由下游 workspace 安全校验处理
13. `terminal_session.command` 不被改写

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/agent/tool-call-normalize.test.ts`
  - 结果：通过，`30 passed`
- `pnpm --filter @ui-chat-mira/server test -- src/agent/graph.test.ts src/agent/tool-call-normalize.test.ts`
  - 结果：通过，`47 passed`
- `pnpm check`
  - 结果：通过

## Smoke Test

- 前台已补真实绑定 workspace 的 smoke 证据
- 测试入口：内置浏览器 `http://127.0.0.1:5173/#/chat`
- 线程绑定方式：输入框左侧 `+ -> Workspace -> Add to workspace`
- 绑定目标：`PW Test -> D:\testData`
- 触发方式：在已绑定线程中点击 `重新生成`
- 输入问题：`看看当前 workspace 有哪些文件`
- 观察结果：
  - Agent trace 已继续进入 `工具执行 -> 证据写回 -> 组织最终回答 -> 检查结果`
  - `read_list` 未卡在 workspace path approval
  - 最终回答明确引用当前 workspace 路径 `D:\testData`
  - 最终列出的目录和文件来自 `D:\testData`，不再误落到 `D:\workspace\rag-demo`
- 这轮 smoke 证明线程配置里的 workspace path 已被 Agent 运行时真实消费，而不是只停留在前台绑定状态

## Changed Files

- `server/src/agent/tool-call-normalize.ts`
- `server/src/agent/tool-call-normalize.test.ts`
- `docs/project-control/tasks/agent_node_T011-workspace-path-argument-contract.md`
- `docs/project-control/agent-nodes-workboard.md`

## Final Status

- `T011 = DONE`

## Notes

- `/etc/passwd` 不会被 normalize 成 `etc/passwd`
- root-relative path normalizer 不再无脑处理所有 `/xxx`
- `/README.md`、`/docs/README.md` 也不再在 normalize 阶段被静默洗成 workspace-relative path
- 本轮没有引入 runtime fallback，也没有放松 workspace root 边界
- 本轮补充的前台 smoke 同时确认：绑定线程的 workspace path 已从线程配置正确透传到 Agent 执行链路
