# MCP 市场应用接入 Agent 的当前认知

Status: Current
Owner: runtime
Last verified: 2026-07-14
Layer: raw-source
Module: MCP / Agent
Feature: MarketplaceAgentIntegration
Doc Type: architecture
Canonical: true
Related:
  - external-mcp-marketplace.md
  - ../tooling-runtime/harness-runtime-design.md
  - ../tooling-runtime/tools-protocol.md
  - ../concepts/CONCEPT_MCP.md

## 单点真相范围

这篇文档回答一个问题：

> MCP 市场中的第三方应用，经过什么条件和运行时边界，才能成为 Agent 本轮可以选择并执行的工具？

这里的“应用”通常表现为一个 external MCP server。它可能通过 `streamable-http` 暴露远端服务，也可能由 backend 通过 `stdio` 启动本地进程。两种 transport 的连接细节不同，但进入 Agent 后必须遵守同一套候选、审批、Harness、Evidence 和失败处理合同。

## 结论先说

MCP 市场不是 Agent 的工具列表，市场条目也不是安全白名单。

市场只负责提供发现元数据。一个外部应用要进入 Agent，必须经过以下链路：

```text
市场发现
  -> 安装记录
  -> 用户接受第三方免责声明
  -> 配置并连接
  -> Discover 远端 MCP tools
  -> 投影为本地 capability
  -> 用户单独开启 Agent Access
  -> 本轮候选暴露与语义选择
  -> Policy / Approval
  -> Harness 执行
  -> Evidence / Trace / Artifact
  -> Agent 继续、结束或报告受保护的失败
```

其中任一前置条件不满足，外部 capability 都不应进入 Agent 候选集合，更不能仅凭 `selectedToolId` 或模型输出直接执行。

## 四个概念必须分开

### 市场应用

市场应用是第三方 server 的发现对象。它有名称、说明、版本、transport、安装方式和文档入口，但这些信息只描述“它可能是什么”，不证明“它可以执行”。

### MCP capability

MCP server 通过协议暴露的 tool 或 resource 是协议能力。当前 Agent 接入主线只投影远端 tool；resource、prompt 和自动更新不属于本轮已完成范围。

### Projected capability

为了让外部 tool 进入现有 Harness，backend 为它生成稳定的本地投影 id：

```text
mcp:<serverId>:tool:<toolName>
```

投影 id 是本地运行时的执行身份。它把远端名称、server 身份、schema、风险元数据和本地 Harness 注册关联起来。模型不能把一个泛化的“能力名”当成可执行 tool id。

### Agent tool

Agent 本轮实际可选的是经过资格校验、暴露筛选和语义匹配后的 projected capability。它仍然要经过 Planner、Normalize、Policy、ToolNode 和 Harness，不能在 Planner 或 Agent 节点里直接发送 MCP `tools/call`。

## 资格：什么情况下能被 Agent 看见

Agent 候选由后端单点 resolver 产生。当前资格至少要求：

- server 已启用；
- 用户已单独开启 Agent Access；
- 用户已接受该 server 的免责声明；
- server 状态为 `connected`；
- transport 配置完整；
- Discover 结果非空；
- projected capability 仍存在于 Harness Registry；
- 当前调用明确允许 external capability，并且 allowlist 包含这个精确的 projected id。

`enabled` 和 `agentEnabled` 是两个不同状态：前者控制 server 是否运行，后者代表用户是否允许 Agent 使用。安装、Connect 或 Discover 不会自动开启 Agent Access；新安装和迁移数据默认关闭 Agent Access。

删除、禁用、配置变更、撤销 Agent Access 或 Discover 失效，都必须使 capability 退出资格集合。配置变更会清空旧 Discover 结果并移除旧投影，避免旧 schema 或旧 endpoint 被继续使用。

## 暴露：本轮 Agent 如何选择

资格 resolver 只回答“哪些 external capability 可以参加本轮”。它不替代 Agent 的语义选择。

当前选择流程是：

1. Agent intent matcher 获取精确的 external projected capability id。
2. 这些 id 作为 `allowedExternalToolIds` 传给 Harness candidate resolver。
3. external capability 与 internal capability 共用 exposure、topK、minScore、embedding、rerank、task model 和 Tool Guard 链路。
4. 候选文档只包含有限长度的 capability id、标题、描述、标签、input schema 摘要和 server display name。
5. 完整 schema、headers、env、token 和其他 secret 不进入模型上下文。
6. candidate resolver 返回本轮允许的真实 tool id，Planner 只能从中选择。

`allowExternal` 只是 external 分支的显式开关，不等于“放开所有外部 MCP”。allowlist 为空、包含未注册 id，或不包含某个已注册 external id 时，该 capability 都不会进入 exposure。普通 `chat_surface` 仍默认屏蔽 external capability，不因为 Agent 主线已接通而自动暴露。

## 执行：Agent 不能绕过 Harness

一次 external MCP 调用的责任分层如下：

```text
Planner
  -> 选择 projected capability 和参数
Normalize
  -> 校验 tool id、参数和输入 hash
Policy
  -> 判断风险、权限和是否需要审批
Approval
  -> 冻结本次 pendingToolCall，等待用户决定
ToolNode
  -> 只执行已批准的冻结调用
Harness
  -> 统一进入 MCP invocation 生命周期
External MCP transport
  -> 连接远端 HTTP 或 backend 持有的 stdio session
Evidence
  -> 记录结果、错误、恢复信息和可验证事实
```

审批授权是一次性的，并且绑定冻结后的 tool id、输入和 input hash。Harness 尝试完成后，批准记录会被消费；后续 Planner 重新规划不能复用旧批准再次执行同一调用。server、Agent Access、Discover 条目和 Harness Registry 在执行前还要重新核验。

## Transport 只是执行细节，不改变 Agent 合同

### `streamable-http`

backend 负责 endpoint、session header、timeout 和 JSON-RPC 交互。renderer 不直接连接远端 MCP endpoint。网络访问风险属于 external capability 的默认风险信息，不能因为它来自市场就被视为可信。

### `stdio`

backend 负责启动和持有 server 子进程、传递显式 args/env、读取协议响应和清理 session。进程能够启动不等于 MCP 可用；至少要验证 `initialize`、`notifications/initialized` 和 `tools/list` 均能完成。

两种 transport 的连接失败、session 失效、timeout、JSON-RPC error 和非法结果，都必须转为统一的 external invocation failure，而不是让 Agent 把失败伪装成成功。

## 结果、Evidence 和安全边界

外部调用的结果不是一段可以直接信任的模型文本。运行时需要同时保留：

- projected capability id；
- external server id 和远端 tool 名称；
- invocation 状态；
- 结果或错误摘要；
- 是否发生过一次恢复；
- trace、事件和 artifact 的关联。

结果进入 Agent 前要经过 schema 和大小边界处理；Evidence 和最终回答只能引用实际返回且可验证的事实。

secret 不应出现在 renderer 返回、Evidence、trace、日志、artifact metadata 或最终回答中。当前已覆盖 bearer token、secret、custom header/env 敏感值的基本递归脱敏；custom header/env 的全面覆盖仍列为已知债务，后续需要继续补充字段识别和回归样本。

## 失败与恢复

外部 MCP 不稳定是正常运行状态，不应被包装成内部工具成功。当前处理原则是：

- 可恢复的 transport 或 session 失败进入统一 recoverable failure 合同；
- HTTP 和 stdio session 失效时最多自动恢复一次；
- 恢复后必须重新建立和核验 session，不能复用失效连接的假状态；
- 恢复耗尽后，Graph 停止额外的工具执行并生成受保护的失败结果；
- 后续 Planner 不得因为旧 approval 或旧 projected capability 状态而重复调用；
- 用户看到的是已确认的失败事实和下一步，而不是“已完成”类固定成功文案。

复杂 recovery 策略、external 失败后的自动重试收敛和完整真实端到端黑盒链路，都是已知债务，不是当前合并阻断。

## 为什么不能直接把市场应用塞进 Agent

直接暴露会同时破坏几个边界：

- 市场元数据会被误当成执行许可；
- server 的 enabled 状态会被误当成用户授权；
- 远端 tool 名称会绕过本地 capability identity；
- Planner 可能绕过 Policy 和 Approval 直接触发副作用；
- secret、headers、env 或原始结果可能进入模型上下文和审计记录；
- transport 失败可能被模型解释成成功；
- 配置变更后旧 Discover schema 可能继续执行。

因此，MCP 市场接入 Agent 的核心不是“增加几个 tool”，而是把第三方应用纳入一个可撤销、可审计、可恢复的本地执行边界。

## 当前完成度

截至 2026-07-14，T001、T002、T003 已合并，当前主链路已完成：

- external server eligibility；
- 用户授权后的 Agent exposure 和 selection；
- projected capability 进入 Harness candidate resolver；
- approval、冻结调用和一次性批准消费；
- HTTP / stdio invocation；
- 一次 recovery、timeout、JSON-RPC error 和非法 result 处理；
- Evidence、trace、artifact 和最终回答的基本脱敏；
- Agent blackbox、invocation、redaction 和 approval smoke 回归测试。

这表示“市场安装的 MCP 应用可以受控地成为 Agent 的候选工具”已经是当前运行时能力，而不是只停留在产品设计层。

## 已知债务

以下内容明确保留为后续工作，不作为当前三张任务卡的合并阻断：

- custom header/env 的全面脱敏覆盖；
- 完整真实端到端黑盒链路；
- 更复杂的 session recovery 和自动重试收敛策略；
- OAuth 账号绑定和凭据托管的完整产品化；
- MCP resources、prompts 和非核心内置 MCP 包管理；
- server 自动更新、自动 Discover 和多 MCP 协同编排；
- 普通 chat surface 的 external capability 自动暴露策略。

## 后续设计原则

后续扩展应保持以下顺序和边界：

```text
先确认 server 生命周期
  -> 再确认 capability 投影
  -> 再确认候选暴露
  -> 再确认审批与 Harness 执行
  -> 最后扩大 chat 或多 MCP 编排范围
```

任何新 transport、新的市场来源或新的 Agent surface，都必须回答四个问题：

1. 它的真实执行入口是否仍然是 Harness Registry？
2. 用户授权是否能单独撤销，并在执行前重新核验？
3. secret、原始结果和错误是否有明确的脱敏及审计边界？
4. 失败后是否能停止重复副作用，而不是生成未经证实的成功回答？

如果这四个问题没有明确答案，就只能停留在市场发现或手动调试阶段，不能直接进入 Agent 自动选择链路。
