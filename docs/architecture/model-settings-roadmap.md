---
status: current
owner: model-settings
last_verified: 2026-07-06
layer: architecture
module: ModelSettings
feature: ModelRoleAndProviderRoadmap
doc_type: roadmap
canonical: true
related:
  - docs/architecture/model-config-api.md
  - docs/project-control/model-settings-workboard.md
  - docs/project-control/tasks/modelset_T001-role-expansion.md
  - docs/project-control/tasks/modelset_T002-image-provider-adapters.md
  - docs/project-control/tasks/modelset_T003-google-and-custom-openai-providers.md
  - docs/project-control/tasks/modelset_T004-model-settings-ui-refinement.md
---

# Model Settings Roadmap

本页定义模型配置系统的四阶段路线图。

当前目标不是一次性重写 provider 系统，而是把新增模型角色、生图能力、自定义服务商和前端交互拆成可独立验收的任务包。

## Current State

当前模型角色是固定集合：

```text
llm
task
evaluation
embedding
rerank
```

当前 provider 也是固定集合：

```text
ollama
lmstudio
openai
cloudflare
volcengine
```

这意味着当前系统可以表达“给固定服务商绑定默认模型”，但还不能稳定表达：

- Agent 专用任务模型
- 生图模型
- OpenAI Images / ComfyUI 生图服务商
- Google provider
- 用户自建多个 OpenAI-compatible 服务商实例

## Product Direction

模型配置系统需要逐步从“固定 provider code + 固定角色”演进到：

```text
model role
  -> default model assignment
  -> provider connection instance
  -> provider template / adapter
```

其中：

- `model role` 表达业务用途。
- `provider connection instance` 表达用户配置的一条真实服务商连接。
- `provider template / adapter` 表达协议类型和调用方式。

## Role Semantics

目标角色集合：

| Role | Purpose |
| --- | --- |
| `llm` | 普通对话、主回答生成 |
| `task` | 轻量任务，例如改写、分类、小判断 |
| `agentTask` | Agent 规划、工具意图识别、下一步决策、执行状态判断 |
| `evaluation` | 评测样本生成、生成类评测裁判 |
| `embedding` | 文本向量化和语义检索 |
| `rerank` | 检索结果重排 |
| `imageGeneration` | 生图请求 |

`agentTask` 不应复用现有 `task`。两者调用强度、失败影响面和提示词约束不同，混在一起会导致普通轻任务与 Agent loop 互相牵制。

`imageGeneration` 不应走 chat adapter。它需要独立 image adapter 和独立参数协议。

## Phase 1: Role Expansion

目标：只扩展模型角色，不重写 provider 架构。

范围：

- 增加 `agentTask`。
- 增加 `imageGeneration`。
- 允许现有服务商模型被设置为 AgentTask / ImageGeneration 默认模型。
- 模型设置页展示两个新角色。
- Agent 内部可从 `agentTask` 读取默认模型。
- 生图模型本阶段只完成配置绑定，不强制完成生图调用。

非目标：

- 不做自定义服务商实例。
- 不接 ComfyUI。
- 不重写 provider storage。
- 不改变现有 `llm / task / evaluation / embedding / rerank` 行为。

对应任务卡：

- `modelset_T001-role-expansion`

## Phase 2: Image Provider Adapters

目标：让 `imageGeneration` 有真实调用能力。

范围：

- 新增 image adapter 抽象。
- 接入 OpenAI Images。
- 接入 ComfyUI。
- 定义最小生图请求 / 响应协议。
- 支持错误返回和调用观测。

非目标：

- 不做 Google provider。
- 不做自定义 OpenAI-compatible provider CRUD。
- 不改已有 chat / embedding / rerank 调用协议。

对应任务卡：

- `modelset_T002-image-provider-adapters`

## Phase 3: Google And Custom OpenAI Providers

目标：扩展 provider 生态，并开始支持多实例自建服务商。

范围：

- 增加 Google provider。
- 增加自定义 OpenAI-compatible 服务商。
- 引入 provider template 与 provider connection instance 的分层。
- 支持用户创建多个 OpenAI-compatible 连接。
- 保留旧 provider 配置的兼容迁移路径。

非目标：

- 不重做模型设置页面的大交互。
- 不把 integration provider 与 model provider 混用。
- 不破坏旧数据。

对应任务卡：

- `modelset_T003-google-and-custom-openai-providers`

## Phase 4: Frontend UI Refinement

目标：把前面新增能力收敛成清晰的模型设置体验。

范围：

- “平台模型设置”改造成“服务商连接 + 默认角色绑定”。
- 区分内置服务商和自定义服务商。
- 默认模型卡片按用途分组。
- 角色绑定按钮数据驱动。
- 展示服务商支持的能力。

非目标：

- 不新增后端 provider adapter。
- 不做新的模型调用能力。
- 不改变 Phase 1-3 已建立的数据合同。

对应任务卡：

- `modelset_T004-model-settings-ui-refinement`

## Execution Order

执行顺序固定为：

```text
modelset_T001 -> modelset_T002 -> modelset_T003 -> modelset_T004
```

允许的例外：

- `modelset_T004` 可以先做低风险文案和布局准备，但不得提前改 provider 数据合同。
- `modelset_T002` 可以在 `modelset_T001` 完成后独立推进，不等待 `modelset_T003`。

## Risks

1. `providerCode` 当前是多张表和前后端类型的核心键，自定义多服务商不能只靠新增枚举解决。
2. 生图协议与 chat 协议不同，强行复用 chat adapter 会导致参数、响应和错误处理失真。
3. Agent 专用模型与普通 task 模型混用会让调优和故障定位困难。
4. 前端如果继续手写每个角色按钮，角色扩展会反复引入遗漏。

## Acceptance Boundary

路线图完成后，系统应满足：

- 每类模型角色都有清晰业务语义。
- Agent 可以独立选择 AgentTask 模型。
- 生图模型可以独立配置并调用。
- 用户可以创建多个自定义 OpenAI-compatible 服务商实例。
- 前端能清楚区分服务商连接、模型同步、默认角色绑定。
