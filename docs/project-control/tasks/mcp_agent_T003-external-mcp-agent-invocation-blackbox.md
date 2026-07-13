---
status: complete
priority: P0
owner: agent-runtime
last_verified: 2026-07-14
layer: project-control
module: Agent
feature: ExternalMcpAgentInvocationBlackbox
doc_type: task-card
canonical: true
task_state: DONE
related:
  - docs/project-control/tasks/mcp_agent_T001-external-mcp-agent-eligibility.md
  - docs/project-control/tasks/mcp_agent_T002-external-mcp-agent-exposure-and-selection.md
  - docs/architecture/external-mcp-marketplace.md
  - server/src/mcp/external.ts
  - server/src/agent/tool-node.ts
  - server/src/agent/evidence.ts
---

# mcp_agent_T003 External MCP Agent Invocation Blackbox

## Dependency

依赖：

- `mcp_agent_T001`
- `mcp_agent_T002`

## Target

完成从用户自然语言请求到外部 MCP 执行、审批、Evidence 和最终回答的完整闭环。

目标链路：

```text
用户请求
→ Agent candidate
→ projected capability selected
→ Planner
→ Normalize
→ Policy
→ waiting_approval
→ 用户批准
→ ToolNode
→ Harness Invocation
→ external MCP tools/call
→ Evidence
→ Planner / Generate
→ grounded final answer
```

不得在 Agent 节点内直接调用 MCP。

## Source Trigger

当前 external MCP 已具备：

- Marketplace记录创建
- Connect
- Discover
- projected capability registration
- Harness按 projected capability id手动调用

但尚未完成 Agent 自动选择后的审批与执行闭环。

## Required Scope

### 1. Preserve Existing Agent Loop

外部 MCP invocation 必须继续经过：

```text
Tool Select
→ Tool Guard
→ Planner
→ Normalize
→ Policy
→ ToolNode
→ Harness Invocation
→ Evidence
→ Planner / Generate
```

不得：

- 在 Planner中直接调用 `tools/call`
- 在 Agent Node中直接调用 external MCP service
- 使用 selectedToolId绕过 frozen pendingToolCall
- 使用 capabilityIntent.selectedToolIds作为执行入口

### 2. Approval Contract

外部 MCP projected capability必须保持：

```ts
requiresApproval: true
networkAccess: true
longRunning: true
```

首次执行必须进入现有 approval流程。

必须核验：

- Policy审批的是 frozen `pendingToolCall`
- 用户拒绝时不得执行远端 MCP
- 用户批准后只执行该 frozen call
- approval resume不得重复执行或更换tool args

不重做 approval系统。

### 3. Pre-Invocation Revalidation

实际执行前必须重新检查：

- server仍存在
- server `enabled === true`
- server `agentEnabled === true`
- capability仍属于该server最新Discover结果
- capability仍注册在Harness Registry
- 用户批准的是当前 frozen `pendingToolCall`
- tool args通过schema validation

撤销 Agent Access、禁用 server或重新Discover移除工具后，旧计划不得继续调用。

### 4. Bounded Runtime Ready Recovery

不得相信数据库中的：

```text
status: connected
```

就代表当前真实session可用。

增加有界恢复：

#### stdio

- 没有活跃进程时允许重新创建session
- 子进程异常退出后第一次调用允许重新initialize
- 最多自动恢复一次

#### streamable-http

- session失效或服务要求重新initialize时，允许重新initialize
- 最多自动恢复一次

#### 共同要求

- 不无限retry
- 第二次仍失败则返回明确tool failure
- recovery次数与结果进入diagnostics
- 不因普通网络/session失败把Graph升级成terminal failure

不得为此重写完整MCP Runtime Manager。

### 5. Recoverable Failure Contract

外部 MCP普通失败必须进入现有 recoverable tool failure合同：

- Tool execution = failed
- latestSummary = failed
- answerReadiness = false
- 允许bounded recovery / replan
- recovery耗尽后Generate guarded answer
- Graph.status = completed
- Chat.finishReason = stop

只有现有terminal条件才允许：

- Graph.status = failed
- finishReason = error
- Generate不执行

不得修改 C 合同。

### 6. Evidence And Secret Safety

Evidence至少记录：

- projected capability id
- external MCP server id
- remote tool name
- invocation status
- normalized result summary或error summary
- recovery是否发生

不得把以下内容写入 Evidence、trace、日志或最终回答：

- bearer token
- secret_json
- custom headers敏感值
- env secret
- Authorization header

如需记录配置，只能记录redacted metadata。

### 7. Full Blackbox Tests

必须从 Agent公开入口构造完整黑盒测试，不接受只验证：

```ts
executeHarnessInvocation(projectedCapabilityId)
```

的局部测试作为完成证据。

至少覆盖完整成功链：

```text
创建安装记录
→ Connect
→ Discover
→ 开启 Agent Access
→ 用户提出匹配请求
→ Agent选中projected capability
→ waiting_approval
→ 用户批准
→ Harness tools/call
→ Evidence
→ grounded final answer
```

还必须覆盖：

1. 用户拒绝审批
2. MCP被禁用
3. Agent Access被撤销
4. Discover后远端工具被移除
5. stdio进程退出后有界重连
6. HTTP session失效后有界reinitialize
7. 应用重启后第一次调用
8. MCP返回JSON-RPC error
9. MCP返回非法或空result
10. timeout
11. repeated-tool guard不退化
12. approval resume不重复调用
13. secret不出现在trace / Evidence / answer

### 8. Real Frontend Smoke

选择一个低风险、只读、输出容易核验的外部 MCP完成真实前台 smoke。

记录：

- 安装
- Connect
- Discover
- Agent Access开启
- 用户自然语言请求
- candidate / selected tool diagnostics
- waiting_approval
- 批准
- external invocation
- Evidence
- 最终回答

不得选择高风险写操作MCP用于首次 smoke。

不得伪造 smoke结果。

### 9. Documentation Closeout

更新：

```text
docs/architecture/external-mcp-marketplace.md
```

将当前：

```text
市场 → 安装 → 连接 → Discover → 投影 → 手动调用
```

更新为实际完成状态：

```text
市场 → 安装 → 连接 → Discover → 用户授权Agent使用
→ Agent语义选择 → 审批 → Harness调用 → Evidence → 回答
```

同时明确仍不在本期范围：

- OAuth
- MCP resources
- MCP prompts
- server自动更新
- 自动安装
- 自动Discover
- 每工具细粒度权限
- 多MCP编排

完成后将MCP Agent线标记为：

```text
Job Release Complete
```

## Allowed Changes

- external MCP invocation wrapper的小范围恢复逻辑
- Policy / ToolNode与现有Harness invocation的接缝
- Evidence normalization
- diagnostics
- integration / blackbox tests
- external MCP architecture documentation
- 前台smoke记录

## Forbidden Changes

- 不修改Agent Graph拓扑
- 不新增nextAction类型
- 不重做approval系统
- 不新增完整MCP Runtime Manager
- 不自动批准MCP
- 不接OAuth、resources、prompts
- 不实现多MCP编排
- 不将secret写进trace
- 不为了smoke使用高风险写操作MCP
- 不伪造真实前台验证
- 不把普通MCP网络失败升级成terminal graph failure

## Invariants

1. Planner只输出nextAction
2. Normalize只冻结合法pendingToolCall
3. Policy只审批frozen pendingToolCall
4. ToolNode只执行approved frozen pendingToolCall
5. ToolNode不得直接answer
6. external MCP只通过Harness Invocation执行
7. selectedToolId不是执行入口
8. capabilityIntent.selectedToolIds不是执行入口
9. approval拒绝不得执行远端工具
10.普通MCP失败保持recoverable合同
11. runtime recovery有界
12. secret永不进入用户可见或诊断证据

## Acceptance Criteria

1. eligible external MCP能被Agent自动选择
2. 执行前必经Policy approval
3. 拒绝审批时远端MCP未被调用
4. 批准后只通过Harness执行
5. 执行前会重新核验server与Agent Access资格
6. 成功结果进入Evidence并生成grounded answer
7. MCP普通失败按recoverable合同收口
8. stale session可有界恢复且不无限重试
9. 禁用或撤销Agent Access后立即不可调用
10. remote tool被Discover移除后旧计划不可执行
11. secret不出现在日志、trace、Evidence和回答中
12. repeated-tool guard与approval resume不退化
13. 完整黑盒测试通过
14. typecheck与项目检查通过
15. 真实前台smoke有原始证据
16. 架构文档更新并标记Job Release Complete

## Verification Plan

至少执行：

```bash
pnpm --filter @ui-chat-mira/server test -- <external-mcp-blackbox-tests>
pnpm --filter @ui-chat-mira/server typecheck
pnpm check
```

如触及desktop或打包边界，再执行：

```bash
pnpm --filter @ui-chat-mira/desktop typecheck
pnpm package:electron:win
```

真实smoke必须记录实际运行环境、MCP名称、输入、审批、输出和异常。

## Evidence Requirements

提交评审时必须附上：

1. changed files
2. 成功黑盒链路原始输出
3. 拒绝审批调用计数证据
4. runtime recovery测试证据
5. recoverable failure状态证据
6. secret redaction证据
7. repeated-tool与approval resume回归证据
8. 所有测试命令与结果
9. 真实前台smoke记录
10. 文档diff
11. 未执行项及原因
12. 已知风险与非目标

## Review Prompt

你正在评审 `mcp_agent_T003 External MCP Agent Invocation Blackbox`。

请从用户自然语言入口开始做完整黑盒审查。不要接受只验证 projected capability手动调用或 `executeHarnessInvocation()` 的局部测试。

不要扩大到 Agent Graph重构、approval重写、完整MCP Runtime Manager、OAuth、resources/prompts或多MCP编排。

重点核验：

1. external MCP是否经过完整的 Planner → Normalize → Policy → ToolNode → Harness → Evidence链路
2. 是否存在Agent节点直接调用 `tools/call` 的旁路
3. selectedToolId或capabilityIntent.selectedToolIds是否被错误当作执行入口
4. waiting_approval前远端MCP是否完全没有被调用
5. 用户拒绝后调用计数是否仍为0
6. approval resume是否只执行被冻结的pendingToolCall且不会重复调用
7. invocation前是否重新检查enabled、agentEnabled、Discover结果和Registry状态
8. 撤销权限、禁用server或远端移除tool后旧计划是否会被阻断
9. stdio与HTTP恢复是否最多一次，是否可能无限retry
10.普通网络、session、JSON-RPC错误是否保持recoverable C合同
11.是否错误升级成Graph terminal failure
12. Evidence是否包含足够来源信息且不泄露token、secret、headers或env
13. repeated-tool guard是否退化
14.黑盒测试是否从Agent公开入口覆盖完整成功与失败链
15.真实前台smoke是否可核验且未使用高风险写操作MCP
16.架构文档是否准确声明已完成能力与剩余非目标

输出格式：

- 结论：PASS / BLOCKED
- 阻断项
- 非阻断问题
- 完整链路核验
- Approval合同核验
- Runtime recovery核验
- Recoverable / Terminal合同核验
- Secret安全核验
- 黑盒与真实smoke证据核验
- 建议的最小修复

## Implementation Evidence

### Changed Files

- `server/src/mcp/external.ts`
- `server/src/mcp/external-redaction.ts`
- `server/src/mcp/external-agent-blackbox.test.ts`
- `server/src/mcp/external-redaction.test.ts`
- `server/src/mcp/core/invocations.ts`
- `server/src/agent/nodes/tool-node.ts`
- `server/src/agent/resume.ts`
- `server/src/agent/evidence.ts`
- `server/src/agent/types.ts`
- `server/src/agent/__tests__/agentgraph-mainline-blackbox.test.ts`
- `server/src/routes/proxy-provider/chat-agent-approval.smoke.test.ts`
- `docs/architecture/external-mcp-marketplace.md`

### Verified

- T003 Agent blackbox: `1 passed`，覆盖 external candidate、`waiting_approval`、审批前 Harness 调用次数为 `0`、精确 approved frozen call、Harness 调用次数为 `1`、Evidence 来源元数据和 secret redaction。
- MCP / approval / normalization 定向回归：`4 files, 77 tests passed`。
- server typecheck：通过。
- A5 repeated-tool guard 单测：通过，单独使用 `--testTimeout=15000`。

### Verification Evidence

- `agentgraph-mainline-blackbox.test.ts`: `18 tests passed`，包含 external recoverable failure 和 repeated-tool guard。
- `chat-agent-approval.smoke.test.ts`: S1 与 S2-S3 定向通过；批准后的调用次数为 `1`，第二次 approve 后仍为 `1`。
- `external-agent-blackbox.test.ts` 与 `external-redaction.test.ts`: `9 tests passed`，包含 HTTP/stdio recovery、二次失败、timeout、JSON-RPC error、非法结果、revoke、Rediscover 和递归脱敏。
- `pnpm check`: 首次并行执行出现一次 Windows 进程状态码 `3221225477`，随后按原命令重跑成功；成功原始输出见 `.test-artifact/t003-pnpm-check-rerun.txt`，失败原始输出保留在 `.test-artifact/t003-pnpm-check.txt`。
- server typecheck: 通过，原始输出见 `.test-artifact/t003-server-typecheck.txt`。

### Real Chrome Smoke Evidence (2026-07-14)

- 页面：`http://localhost:5173/#/settings/mcp`
- 已安装 MCP：`io.github.06ketan/slideshot`、`com.devexpress-docs`、`ac.tandem/docs-mcp`
- 三个 server 均显示 installed / enabled / connected，Discover 数量分别为 `6 / 2 / 13`。
- 只有 `io.github.06ketan/slideshot` 开启了“允许 Agent 使用”；其 projected tools 包含 `health_check`、`list_themes`、`discover_themes`。
- 按前台手测指引通过输入框 `+ -> Workspace -> Add to workspace` 绑定 `TEST_FOLDER_ALT -> D:\CODEX_TEST_FOLDER_ALT`，Agent 按钮变为可用并切换为 Agent 模式。
- 用例 1：自然语言请求 `health_check`；Agent 选中 `mcp:io.github.06ketan-slideshot:tool:health_check`，进入审批，批准后页面显示恢复执行、工具执行完成、证据整理、最终回答和结果检查；回答返回 slideshot `v4.4.0`、`win32 x64`、Node `v22.17.0`。
- 用例 2：自然语言请求 `list_themes`；Agent 选中 `mcp:io.github.06ketan-slideshot:tool:list_themes`，进入审批，批准后页面显示工具执行完成并返回主题数据。
- 用例 3：自然语言请求 `discover_themes`；Agent 选中 `mcp:io.github.06ketan-slideshot:tool:discover_themes`，进入审批，拒绝后页面显示“工具没有执行”和“Agent 已阻断”。
- 真实 smoke 结论：slideshot MCP 已从前台 Agent 入口进入真实调用，审批合同和拒绝路径均可核验。

### Remaining Work

- 无。已知非目标仍按架构文档所列范围保留。
