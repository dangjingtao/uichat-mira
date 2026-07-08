# Deep Agents JS Spike Report

## Summary

- OS: Windows
- Node: v22.17.0
- deepagents: 1.10.5
- Spike package: `packages/deepagents-spike`

| Scenario | Result | Key Evidence |
| --- | --- | --- |
| minimal-demo | PASS | createDeepAgent 在 Windows + Node 22 本机环境直接可运行。 |
| fake-langchain-tool | PASS | 假的 LangChain tool 已接入 createDeepAgent。 |
| provider-gateway-like | PASS | 本地 OpenAI-compatible 假网关收到请求次数: 2 |
| local-mcp-tool | PASS | MCP tool 名称: local_lookup |
| filesystem-permissions | PASS | 允许路径写入结果: Successfully wrote to '/allowed/note.txt' |
| trace-mapping | PASS | streamEvents(v2) 可以提取 graph / middleware / model / tool 级别信号。 |
| observability | PASS | todo state: [{"content":"verify deepagents observability","status":"in_progress"}] |

## Scenario Details

### minimal-demo
- 结果：PASS
- createDeepAgent 在 Windows + Node 22 本机环境直接可运行。
- 最小 invoke 最终消息: minimal deep agent ok
- 返回状态字段包含: messages, todos, files

### fake-langchain-tool
- 结果：PASS
- 假的 LangChain tool 已接入 createDeepAgent。
- tool 输出: lookup:deepagents
- fake model 调用次数: 2

### provider-gateway-like
- 结果：PASS
- 本地 OpenAI-compatible 假网关收到请求次数: 2
- 首个请求 model: gateway-demo
- tool 输出: gateway:provider gateway
- 最终消息: gateway tool flow completed
警告：
- 本机缺少 DATABASE_URL，未验证项目当前 DB 驱动的 provider 解析链；本场景只验证 openai-compatible transport 这一层与 deepagents 兼容。

### local-mcp-tool
- 结果：PASS
- MCP tool 名称: local_lookup
- MCP tool 输出: mcp:deepagents-mcp
- 加载到的 MCP tools: local_lookup

### filesystem-permissions
- 结果：PASS
- 允许路径写入结果: Successfully wrote to '/allowed/note.txt'
- 阻止路径写入结果: Error: permission denied for write on /blocked/secret.txt
- createDeepAgent 仍然暴露 filesystem tools；本场景证明它们可被 permissions 限制，但没发现直接禁用整个 filesystem middleware 的 top-level 开关。

### trace-mapping
- 结果：PASS
- streamEvents(v2) 可以提取 graph / middleware / model / tool 级别信号。
- on_chain_start / LangGraph -> graph
- on_chain_start / __start__ -> graph
- on_chain_end / __start__ -> graph
- on_chain_start / FilesystemMiddleware.before_agent -> middleware
- on_chain_end / FilesystemMiddleware.before_agent -> middleware
- on_chain_start / patchToolCallsMiddleware.before_agent -> middleware
- on_chain_stream / LangGraph -> graph
- on_chain_end / patchToolCallsMiddleware.before_agent -> middleware
- on_chain_start / model_request -> graph
- on_chain_stream / LangGraph -> graph
- on_chat_model_start / FakeBuiltModel -> model
- on_chat_model_end / FakeBuiltModel -> model

### observability
- 结果：PASS
- todo state: [{"content":"verify deepagents observability","status":"in_progress"}]
- subagent 事件样本: on_chain_start:LangGraph | on_chain_start:__start__ | on_chain_end:__start__ | on_chain_start:FilesystemMiddleware.before_agent | on_chain_end:FilesystemMiddleware.before_agent | on_chain_start:patchToolCallsMiddleware.before_agent | on_chain_stream:LangGraph | on_chain_end:patchToolCallsMiddleware.before_agent
- 本次 spike 没有稳定触发 history summarization/offload 状态，已确认 task/subagent offload 可观察，但内部 summarization offload 仍需二阶段单独验证。
警告：
- history summarization/offload 的外部观测在这次 spike 中没有拿到稳定复现证据。

## 能复用什么

- `createDeepAgent` + LangChain tool 接口可以直接复用，最小 demo、假 tool、MCP tool 都已跑通。
- `streamEvents` 暴露的 graph / middleware / model / tool / subagent 信号可以作为现有 trace 的原始素材，至少能做适配层，不需要从零发明事件源。
- openai-compatible transport 层和 `ChatOpenAI` 可以对接本项目 Provider Gateway 的协议形态，说明 deepagents 不是只能跑 OpenAI 官方直连。

## 不能复用什么

- 现有 Harness 的审批链、状态模型、trace node contract 不能原样复用到 deepagents；需要单独做映射层。
- deepagents 默认内建 filesystem / todos / subagent / summarization middleware，能力面比当前 Harness 更宽，没有看到一个直接关闭 filesystem middleware 的简单开关。
- 本机这次没有拿到真实 DB 驱动 Provider Gateway 解析链证据，所以“当前项目 provider settings -> gateway -> deepagents”不能宣称已经全链路复用。

## 和现有 Harness 冲突点

- 事件语义冲突：deepagents 输出的是 LangGraph / middleware / tool 事件流，现有 Harness trace 是项目自定义节点合同，不能直接混写。
- 状态所有权冲突：deepagents 自带 `todos`、`files`、`_summarizationEvent` 等状态；现有 Harness 有自己的 run state、evidence、approval/resume 合同。
- 能力边界冲突：deepagents 默认信任模型并放大工具权限，而当前 Harness 明确有审批、路由、约束和协议分层。
- 依赖版本冲突：deepagents 依赖的 `langchain` / `@langchain/core` / `zod` 明显新于主仓当前主线，所以直接并到 `server` 风险高。

## 安全风险

- filesystem middleware 默认开启，且 permission 默认是 permissive。如果没有显式 deny 规则，模型可以直接读写工作区文件。
- 如果未来改用 `LocalShellBackend`，deepagents 还会暴露 `execute`，那是直接宿主机 shell 执行，不是轻量风险，是高风险运行边界变化。
- subagent/task 默认可把工作分发到额外上下文，若没有和现有审批/审计模型对齐，会出现“主链看起来正常，但实际动作在子链里发生”的可见性缺口。
- MCP tool 一旦挂到 deepagents，安全性取决于 MCP server 本身，而不是 deepagents 帮你兜底。

## 是否建议继续第二阶段

有条件建议继续第二阶段。tool / MCP / trace 基础可行，但 history summarization/offload 外部观测、真实 Provider Gateway DB 解析链、以及默认 filesystem/subagent 能力面的收敛方案，需要在第二阶段开工前先单独定界。

第二阶段前必须先补齐这三件事：

- 明确 deepagents 事件到现有 Harness trace 的适配合同，不要直接把原始 LangGraph 事件塞进现有 UI。
- 明确 filesystem / MCP / subagent 的审批与默认 deny 设计，否则能力面会比当前 Harness 更宽。
- 明确 Provider Gateway 的真实集成路径。当前 spike 只验证了 openai-compatible transport 形态，未验证依赖 DB 的 provider 解析链。

## 结论补充

- filesystem tools：这次验证结果是“可限制，未验证到可直接禁用”。
- todo 状态：可从结果状态直接观测。
- subagent offload：可从 `task` tool 事件和 nested chain 观测。
- history summarization/offload：状态类型存在，但这次 spike 没拿到稳定可复现的外部观测证据。
- Provider Gateway：协议形态兼容已验证；真实项目 provider 解析链未验证。
