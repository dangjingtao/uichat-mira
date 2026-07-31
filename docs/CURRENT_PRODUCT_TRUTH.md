---
status: current
owner: project-owner
last_verified: 2026-07-31
layer: wiki
module: Project
feature: ProductTruth
doc_type: current-snapshot
canonical: true
related:
  - ENGINEERING_MEMORY.md
  - PROVIDER_CURRENT_TRUTH.md
  - AGENT_CURRENT_TRUTH.md
  - TOOL_CURRENT_TRUTH.md
  - MICROAPP_CURRENT_TRUTH.md
  - harness/agentgraph-harness-protocol.md
  - skill/README.md
  - knowledge-base/README.md
  - provider/README.md
---

# UIChat Mira 当前产品真相

> 这页只记录当前已经成立的产品事实、能力边界和阶段重点。愿景、POC、路线图和施工过程不能覆盖这里。

## 当前阶段

从 **2026 年 8 月**开始，UIChat Mira 进入功能稳定迭代阶段。

当前优先级：

1. 真实可用性与失败恢复；
2. 已有能力的回归测试；
3. 当前契约一致；
4. 可观测性、诊断与 Evidence；
5. 文档与实现保持同一份真相；
6. 小步、可验证、可回退的增量。

这不等于停止开发，而是停止用新功能掩盖旧能力没有站稳的问题。

## 产品定位

UIChat Mira 是一个 **本地优先、桌面优先、多 Provider 的个人 AI 工作台**。

产品主线不是 OpenAI-only，也不是单一聊天壳。当前工程同时容纳：

- Chat；
- Provider / Model Gateway；
- Knowledge Base / RAG；
- Evaluation；
- Agent；
- Harness 与 Tool Runtime；
- MCP Host；
- Skill / SubAgent；
- MicroApps Hub、领域 Studio 与外部 Runtime。

## 当前已经成立的能力

### 桌面运行与发布

- Electron 与 Tauri 两条桌面路径并存；
- 主项目提供统一开发、构建、校验和发布脚本；
- 桌面端是当前主要产品形态。

### Chat 与 Provider

完整事实见 [[PROVIDER_CURRENT_TRUTH]]。

当前已经成立：

- 支持多个内置 Provider Template 与多个自定义 OpenAI-compatible Connection；
- Provider Template、Provider Connection、模型目录缓存和模型角色绑定是独立对象；
- 模型设置总览当前显示 `llm / task / agentTask / evaluation / embedding / rerank` 六个角色；
- `imageGeneration / voice` 存在于全局角色 schema，但对应 Studio 仍有独立 Provider 配置；
- 模型目录同步支持 Ollama、OpenAI-compatible、Cloudflare 与 Ark Plan 路径；
- Chat 根据角色绑定解析具体 Connection、模型、参数与 adapter；
- AgentTask 未显式绑定时，当前兼容路径回退到 Task；
- 远程 Embedding 支持 Ollama、Cloudflare 与 OpenAI-compatible adapter；
- Rerank 必须由 Template 显式声明，不能从 Chat 兼容推断；
- 内置本地 Embedding / Rerank 使用独立 ONNX / WASM Runtime；
- 模型调用 Observation 已能记录 Provider、协议、endpoint、模型、参数、请求摘要与耗时；
- 模型设置支持包含 Connection、凭据、角色绑定与参数的导入导出。

新安装的第一验收不是“Provider 卡片出现”或“目录同步成功”，而是按 [[provider/FIRST_MODEL_SETUP]] 得到一条真实 Chat 回复。

当前已知边界：

- 模型卡“已配置”只表示保存了 Connection 与 remote model id；
- Provider `connected` 只表示最近一次模型目录同步成功；
- seed 的 Ollama 默认绑定可能在本地服务未启动、模型未下载时形成假就绪感；
- `openai-compatible-custom` 当前在 Runtime Resolution 中映射为 `volcengine` provider code，供应商中立身份尚未完全收口；
- Image / Voice 的全局角色绑定与 Studio provider config 尚未统一；
- Template capability 不是 per-model Vision / Tool / Context 能力探测；
- Provider Proxy 尚未为所有 adapter 统一归一化 Token 与成本；
- 模型设置导出文件包含可恢复的明文 API Key，必须按敏感凭据备份处理。

### Knowledge Base 与 Evaluation

- 知识库、RAG 与相关评测能力已经存在；
- 评测用于验证能力，不替代真实产品验收；
- 具体检索链、schema 和工作台以对应 current-contract 为准。

### Agent

完整事实见 [[AGENT_CURRENT_TRUTH]]。

当前已经成立：

- `AgentRun` 是产品运行真相；
- `AgentGraph` 是稳定门面；
- Pi Loop 是应用默认 Main Agent Runtime；
- LangGraph 是显式兼容与测试对照 Runtime；
- Main Planner 维护 global goal 与下一步；
- concrete tool 经过 Normalize / Policy / Harness / Evidence；
- bounded multi-step work package 可以通过 `delegate_task` 交给 Generic SubAgent；
- 任务型 Skill 可以把领域施工交给 Skill-owned SubAgent 或 deterministic Skill Flow；
- Parent 保留 approval、recovery、terminal contract 与最终交付；
- SubAgent 是单层、受控、task-local execution，不是开放式多 Agent 系统。

当前已知偏差：recoverable recovery exhausted 被 `dev` 实现为 terminal error，和 settled guarded-answer C contract 不一致；该问题尚未在本轮文档整理中修复。

### Harness / Tool / MCP

完整工具事实见 [[TOOL_CURRENT_TRUTH]]。

当前已经成立：

- Harness 是 registry、公共面、暴露、边界、审批、执行、结果和审计控制平面；
- 公共 Read 面是 `read_discover / grep / read_open / codebase_explore`；
- 公共 Edit 面是 `write_file / replace_block / delete_path / move_path`；
- Search 区分公共互联网 `web_search` 与本地 News Hub `news_search`；
- `terminal_session` 是完整 host shell / PTY runtime，不是强隔离 sandbox；
- Managed Browser、Attached Browser、Mail、GitHub、问策和 External MCP 可以按真实 availability 进入工具面；
- <=20 个公共工具全部暴露，>20 才做 ranking 并暴露前 20；
- Mira 以 MCP Host 为主，external MCP 必须 connected、discovered、显式 Agent Access、approval 后执行；
- `delegate_task` 属于 Agent Runtime，不是普通 Harness Tool；
- Skill-private Runtime 不暴露给 Main Planner，也不能凭声明获得可用性。

当前已知 Tool 偏差：settled exact-invocation 审批口径包含 `toolCallId`，但 core matcher 当前只使用 `toolId + inputHash`；该问题本轮只记录，未修改 Runtime。

### Skill

- Skill 是渐进式披露的领域能力包；
- SkillContext、ExecutionProfile、ToolExposure、Runtime readiness 与 Approval 是独立真相源；
- Context-only Skill 可以增强 Main Planner；
- Task Skill 可以使用 forked SubAgent；
- Stateful Skill Flow 是可选确定性 controller；
- V1 禁止 nested SubAgent 与 recursive delegation。

### MicroApps Hub 与 MicroAPP Runtime

完整事实见 [[MICROAPP_CURRENT_TRUTH]]。

当前必须区分：

```text
MicroApps Hub
!= Integration MicroAPP registry
!= Studio Runtime
!= Agent Tool / Skill access
```

当前已经成立：

- 设置页 MicroApps Hub 是宽产品入口，包含 Studio、领域 Runtime、Skill、Tool / MCP 集成和外部连接；
- strict `MicroAppDefinition` registry 当前有七种 definition；
- 只有 `knowledge_query` 完成统一 external AccessPoint invoke，并且只支持 `wecom.smart_robot`；
- Image Generation、Computer Use、TTS、News Hub、CodeGraph 与智识进化库都有各自 Studio / service，但统一 MicroApp invoke 仍为 Studio-only 或未实现；
- Mail Center、文枢、GitHub 和问策在产品中心有真实能力，但不属于当前七种 strict definition；
- Image Generation 已有任务、实时进度、Artifact、Provider / ComfyUI；
- Computer Use 已有 managed browser、持久任务与 Evidence、模型执行器、审批和 Browser tools；
- TTS 已有 Windows、Piper、GPT-SoVITS 与 API Provider；
- News Hub 与 Mail Center 分别通过 `news_search` 与 `mail_query` 进入 Agent 工具面；
- 文枢通过 Skill-owned execution 与 private Runtime 工作；
- GitHub 通过连接入口和四领域 Harness tools 工作；
- Notion、智识进化库等能力仍需按部分实现或实验状态单独说明。

产品入口、definition、领域 Runtime、Integration invoke 和 Agent access 必须逐层证明，不能互相代替。

## 当前不能这样宣传

以下说法不属于当前真相：

- “配置了 Provider 就一定可以聊天”；
- “模型目录同步成功就是完整健康检查”；
- “所有 OpenAI-compatible 服务行为完全一致”；
- “所有模型都天然支持 vision、image、tool 等全部能力”；
- “全局默认模型配置已经统一管理 Chat、Image 和 TTS”；
- “所有 Provider 都可以准确显示 Token 与成本”；
- “Mira 已经是完整自主软件工厂”；
- “已经是成熟开放式多 Agent 平台”；
- “已经有 Agent V2、DAG scheduler 或并发 Agent 编排”；
- “所有 Skill 和 SubAgent 都可以获得任意工具”；
- “所有微应用卡片都来自同一套 Runtime”；
- “MicroApp definition 启用就代表领域 Runtime ready”；
- “所有 Studio 都可以被企业接入点或 Agent 自动调用”；
- “所有微应用和 POC 都已可用于生产”；
- “已经完成通用长期记忆系统”；
- “已经完成强隔离 Sandbox”；
- “Terminal 只能在 workspace 内执行”；
- “CodeGraph 仍只是文档计划”；
- “external MCP 安装后自动获得 Agent Access”；
- “手机端、服务器端和网页端已经是正式交付形态”；
- “文档里写过的计划就是产品承诺”。

## 稳定迭代的判断标准

一个功能只有同时满足以下条件，才适合进入当前真相：

- 有真实产品入口；
- 有明确边界与失败语义；
- 有代码锚点；
- 有可重复验证；
- 有回归保护；
- 文档写清已实现和尚未实现；
- 不依赖施工线程口头结论。

Provider 还必须额外说明：

- 是 Template、Connection 还是具体模型；
- 模型是否只存在于同步缓存；
- 绑定的是哪个 role；
- 当前 Runtime 最终解析到什么；
- `connected` 是目录同步还是业务调用验证；
- 是否走 Provider Proxy、本地模型 Runtime 或 MicroApp Studio；
- 凭据与备份如何处理。

MicroApp 还必须额外说明：

- 是否只是一张产品入口卡片；
- 是否有 strict definition；
- 是否有真实领域 Runtime；
- 是否支持 Integration invoke；
- 是否通过 Tool 或 Skill 进入 Agent。

## 真相优先级

1. 当前代码与可重复验证；
2. current-contract / current-snapshot；
3. 工程共同记忆；
4. 正在施工的 checklist / workboard / ledger；
5. design / plan / research / POC；
6. historical / superseded / archive。

代码和 settled contract 冲突时，必须同时公开当前行为与目标合同，不能用其中一个偷偷抹掉另一个。

## 维护规则

- 产品能力变化时先更新对应 current-contract，再更新这页；
- 新功能验证前只能进入施工与验证或方案与实验；
- 当前文档超过 90 天未核验应显示过期；
- 无状态、无核验信息的文档进入待核验；
- 已知实现偏差必须写明影响与修复状态。
