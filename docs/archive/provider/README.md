---
status: archived
owner: docs / runtime
last_verified: 2026-07-31
layer: historical
module: ModelSetting
feature: ProviderArchive
doc_type: archive
canonical: true
related:
  - ../../PROVIDER_CURRENT_TRUTH.md
  - ../../provider/README.md
  - ../../provider/FIRST_MODEL_SETUP.md
  - ../README.md
---

# Provider 历史归档

> 本目录保存 Provider 从六月的薄索引和混合 Proxy 文档，演进到当前 Connection、Role Assignment 与 Resolution Runtime 的过程。历史资料解释过去，不定义当前模型配置行为。

## 当前真相入口

1. [[PROVIDER_CURRENT_TRUTH]]：Provider 当前总真相；
2. [[provider/FIRST_MODEL_SETUP]]：首次模型配置；
3. [[provider/README]]：当前模块入口；
4. [[architecture/provider-api-standards]]：Template / Adapter 合同；
5. [[architecture/provider-proxy-api]]：Resolution / Proxy Runtime。

## 本次保存的历史快照

### 旧 Provider 模块总纲

- `provider-module-overview-20260626.md`
  - 原 `docs/provider/README.md`；
  - 只有三条文档链接；
  - 没有解释 Provider Connection、模型目录、角色绑定、首次配置和状态语义。

### 旧 API 标准页

- `provider-api-standards-20260624.md`
  - 原 `docs/architecture/provider-api-standards.md`；
  - 记录当时的官方协议参考与少量 Provider 映射；
  - 缺少 Google、自定义多连接、Template/Connection 分离、Image adapter 与完整角色资格。

### 旧 Provider Proxy 混合协议

- `provider-proxy-api-20260624.md`
  - 原 `docs/architecture/provider-proxy-api.md`；
  - 同时混入 Chat message、附件、Thread、RAG 上传和未来分支协议；
  - 公开 provider 枚举停留在 `default / ollama / lmstudio / openai`；
  - 不再适合作为当前 Provider Runtime 单点合同。

### Provider Catalog 重构记录

- `provider-integration-optimization-20260624.md`
  - 原 `docs/architecture/provider-integration-optimization.md`；
  - 记录从 provider-specific 分支迁移到 Catalog / adapter family 的施工过程；
  - 有历史和维护价值，但不是当前产品说明或完整合同。

## 为什么保留原路径

`provider-api-standards.md` 与 `provider-proxy-api.md` 仍是稳定技术入口，因此原路径直接重写为 current contract。

`provider-integration-optimization.md` 被历史任务和搜索结果引用，原路径保留兼容退役页并指向本索引。

## 当前审计补出的关键事实

旧文档没有清楚表达：

```text
ProviderTemplate
→ ProviderConnection
→ ProviderModel Cache
→ ModelRoleConfig
→ ProviderResolution
→ Protocol Adapter
→ Invocation / Observation
```

也没有区分：

- 模型卡“已配置”；
- Provider 目录同步 `connected`；
- 真实业务 invocation 成功；
- 内置本地 Embedding/Rerank；
- Image/TTS Studio 独立配置；
- Template capability 与 per-model capability；
- 模型设置备份中的明文凭据。

这些事实现在由 [[PROVIDER_CURRENT_TRUTH]] 统一说明。

## 阅读规则

历史资料可以回答：

- 为什么建立 Provider Catalog；
- 为什么按 adapter family 分发；
- 旧 Chat/附件协议如何演进；
- 某个 Provider 最初如何接入。

历史资料不能回答：

- 新用户今天怎样配通第一个模型；
- 当前 UI 的连接状态代表什么；
- 当前支持哪些 Template 和角色；
- 当前请求实际走哪个 Connection；
- 自定义 Provider、Image/TTS 和本地 Runtime 当前有什么边界。
