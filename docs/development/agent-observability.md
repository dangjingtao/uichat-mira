---
status: current
owner: agent-runtime
last_verified: 2026-07-04
layer: raw-source
module: Chat
feature: AgentObservability
doc_type: runbook
canonical: true
related:
  - docs/chat/agent-runtime-design.md
  - docs/project-control/tasks/agent_node_T015-phoenix-minimum-human-observability.md
  - server/src/agent/graph.ts
  - server/src/agent/observability.ts
---

# Agent Observability

## 这篇文档解决什么问题

这篇文档只讲一件事：

- 如何在本地开发时开启 AgentGraph 的最小人眼可观测能力，并在 Phoenix 里查看一次完整 run 经过了哪些节点

这不是新的 Agent 平台，也不是 Agent V2。

当前实现只是在 `AgentGraph` 组装层增加统一 tracing 包装：

- 默认关闭
- 显式环境变量开启
- 不改各 node 的业务语义
- 不改 AgentGraph 路由

## 适用范围

当前 tracing 只覆盖 Agent V1.5 的后端图运行：

- `prepareContext`
- `planStep`
- `toolSelectStep`
- `toolGuardStep`
- `nextActionPlanner`
- `toolCallNormalize`
- `policyStep`
- `approval`
- `retrieve`
- `tool`
- `generate`
- `evaluate`
- `error`

同时会额外生成一个根 span：

- `agent.graph.run`

## 本地启动 Phoenix

推荐直接用官方 Docker 方式启动 Phoenix：

```bash
docker run --rm -it -p 6006:6006 -p 4318:4318 arizephoenix/phoenix:latest
```

启动后：

- Phoenix UI: `http://localhost:6006`
- 当前本机 collector 可直接使用：`http://localhost:6006`

如果你已经有自己的 collector 入口，也可以继续用自定义地址。

## 需要设置的环境变量

最小配置：

```bash
AGENT_TRACE_PHOENIX=true
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
AGENT_TRACE_PROJECT=uichat-mira-dev
```

如果想看更完整的 state 摘要，再加：

```bash
AGENT_TRACE_VERBOSE=true
```

说明：

- `AGENT_TRACE_PHOENIX`
  - 只有它显式等于 `true` 时才开启 tracing
- `PHOENIX_COLLECTOR_ENDPOINT`
  - 传 collector 根地址即可
  - 当前实现会自动补成 `/v1/traces`
- `AGENT_TRACE_PROJECT`
  - Phoenix 项目标识
- `AGENT_TRACE_VERBOSE`
  - 打开更完整的开发态 state 摘要

如果你不想每次手工设置，现在也可以直接使用仓库里的专用开发命令：

```bash
pnpm dev:electron:win:trace
```

这个命令会自动注入：

- `AGENT_TRACE_PHOENIX=true`
- `PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006`
- `AGENT_TRACE_PROJECT=uichat-mira-dev`
- `AGENT_TRACE_VERBOSE=true`

它不会替换默认的 `pnpm dev:electron:win`，只是在保留原启动链的前提下增加一个 tracing 专用入口。

## 如何运行一次 AgentGraph 并查看 trace

1. 启动 Phoenix
2. 二选一：
   - 手工设置上面的环境变量
   - 或直接使用 `pnpm dev:electron:win:trace`
3. 启动本地桌面开发链路：

```bash
pnpm dev:electron:win:trace
```

4. 在聊天页绑定 workspace，并用 Agent 模式发一次真实请求
5. 回到 Phoenix UI，按项目名 `uichat-mira-dev` 或你自己的 `AGENT_TRACE_PROJECT` 过滤
6. 打开最新一条 `agent.graph.run`
7. 在这条 trace 下检查各节点 span

## 普通模式会记录哪些字段

普通模式默认记录摘要字段，不记录完整 state 原文。

每个节点 span 至少包含：

- `runId`
- `threadId`
- `nodeName`
- `iterationCount`
- `maxIterations`
- `nextAction.type`
- `pendingToolCall.toolId`
- `policyDecision.type`
- `pendingApproval.toolId`
- `lastToolExecution.toolId`
- `evidence.latestSummary.source`
- `evidence.latestSummary.toolId`
- `evidence.latestSummary.answerReadiness.canAnswer`
- `retrievedChunks count`
- `observations count`
- `answer exists`
- `errorMessage`
- `errorSourceNodeId`
- `blockedReason`
- `latencyMs`

根 span `agent.graph.run` 额外记录：

- `messageCount`
- `requestContextCount`
- `knowledgeBaseId`
- `workspaceRoot`
- `selectedToolId`
- `hasPendingToolCall`
- 最终 `status`
- 最终 `terminalReason`

## verbose 模式会额外记录哪些字段

当 `AGENT_TRACE_VERBOSE=true` 时，每个节点 span 会额外附带脱敏后的 JSON 摘要：

- `nextAction`
- `pendingToolCall`
- `policyDecision`
- `pendingApproval`
- `lastToolExecution`
- `latestEvidenceSummary`
- `retrievedChunks` 的来源与内容预览
- `answerPreview`

根 span 还会记录脱敏后的输入摘要：

- `goal`
- `params`
- `pendingToolCall`
- `approvedInvocations`

## 永远禁止记录的字段

即使开启 verbose，也不会保留明文敏感信息。

永远禁止记录：

- API key
- access token
- refresh token
- secret
- password
- authorization header
- cookie
- credentials
- private key
- session token

## secret 过滤规则

当前实现有两层过滤：

1. 字段名过滤
   - 命中这些字段名直接替换成 `[REDACTED]`
   - 例如：`apiKey`、`token`、`secret`、`password`、`authorization`

2. 字符串模式过滤
   - Bearer token
   - 常见 `sk-...` / `pk-...` / `rk-...` 形式
   - `api_key=...`、`token=...`、`secret=...`、`password=...` 这类字面量

说明：

- 当前过滤目标是开发态排查够用的人眼摘要，不是完整 DLP 系统
- 记录内容会优先保留结构和问题定位信息，而不是原文全部细节

## 如何关闭 tracing

删除或关闭下面这个开关即可：

```bash
AGENT_TRACE_PHOENIX=false
```

或者直接不设置 `AGENT_TRACE_PHOENIX`。

当前实现默认关闭，不会在未开启时主动创建 Phoenix trace。

## 当前边界

这次接入明确保持下面这些不变量：

1. 不改 `Planner / Normalize / Policy / ToolNode / Evidence / Generate` 的业务语义
2. 不改 AgentGraph 条件路由
3. 不在 node 文件里散落插桩逻辑
4. 统一在 `graph.ts` 组装层包装
5. 不把这套最小观测能力扩成自研 observability 平台

## 本地验证建议

建议至少验证下面 3 类请求：

1. `打开 README.md 看看内容`
   - 验证 `toolCallNormalize -> policyStep -> tool -> generate -> evaluate`
2. `看看当前知识库里有没有发布说明`
   - 验证 `retrieve -> generate -> evaluate`
3. `执行 dir 命令看看结果`
   - 验证 `policyStep -> approval`

## 参考

- Phoenix Docker deployment: [arize.com/docs/phoenix/self-hosting/deployment-options/docker](https://arize.com/docs/phoenix/self-hosting/deployment-options/docker)
