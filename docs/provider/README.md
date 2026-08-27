---
status: current
owner: runtime / docs
last_verified: 2026-07-31
layer: wiki
module: ModelSetting
feature: ProviderIntegration
doc_type: overview
canonical: true
related:
  - ../PROVIDER_CURRENT_TRUTH.md
  - FIRST_MODEL_SETUP.md
  - ../architecture/provider-api-standards.md
  - ../architecture/provider-proxy-api.md
  - ../archive/provider/README.md
---

# Provider 与模型文档入口

本目录是 UIChat Mira Provider Connection、模型角色绑定与调用 Runtime 的当前入口。

## 先读这里

### 新用户

1. [[provider/FIRST_MODEL_SETUP]]：把第一个主模型配置到真实聊天成功；
2. [[PROVIDER_CURRENT_TRUTH]]：理解配置状态、同步状态与运行状态为什么不同。

### 工程维护

1. [[PROVIDER_CURRENT_TRUTH]]：当前对象模型、能力矩阵与已知漂移；
2. [[architecture/provider-api-standards]]：Provider Template 和 adapter 协议合同；
3. [[architecture/provider-proxy-api]]：角色解析、请求执行与 Observation；
4. [[archive/provider/README]]：六月旧总纲、混合 Proxy 文档和接入重构记录。

## 当前核心链路

```text
ProviderTemplate
→ ProviderConnection
→ ProviderModel Cache
→ ModelRoleConfig
→ ProviderResolution
→ Protocol Adapter
→ Invocation / Observation
```

阅读时必须分别确认：

| 层 | 要回答的问题 |
| --- | --- |
| Template | 使用哪种同步、Chat、Embedding、Rerank 或 Image 协议 |
| Connection | 实际地址、凭据和连接实例是什么 |
| Model Cache | 最近一次同步发现了哪些模型 |
| Role Config | 哪个模型承担 `llm / task / agentTask / evaluation / embedding / rerank` |
| Resolution | 本次调用最终解析到了什么 |
| Adapter | 请求怎样投影到上游协议 |
| Observation | 实际调用、耗时、结果和错误是什么 |

## 当前文档边界

### Provider 文档负责

- 首次配置；
- Provider Template / Connection；
- 模型目录同步；
- 模型角色绑定；
- Chat / Embedding / Rerank 运行时解析；
- Provider invocation metadata 与错误；
- 导入导出安全；
- 当前已知实现漂移。

### 其他模块负责

- Image Generation Studio：[[microapp/README]]；
- TTS Studio：[[microapp/README]]；
- 知识库索引和 RAG：[[knowledge-base/README]]；
- Agent 任务模型如何进入 Planner / Generate：[[AGENT_CURRENT_TRUTH]]；
- Context 预算和压缩：对应 Context current contract；
- 历史 Provider 接入重构：[[archive/provider/README]]。

## 当前最重要的状态语义

```text
模型卡已配置
= 已保存 connection + remote model id

Provider connected
= 最近一次模型目录同步成功

Runtime verified
= 真实业务请求成功
```

新用户必须以真实 Chat 回复作为第一次配置完成标准。

## 历史入口

旧 Provider 总纲、旧 API 标准、旧 Provider Proxy 混合协议和接入优化说明已保存到 [[archive/provider/README]]。

原路径中的当前文档已经按现有代码重写；历史正文不再拥有当前解释权。
