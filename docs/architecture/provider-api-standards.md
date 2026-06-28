# Provider API Standards

Layer: raw-source
Module: ModelSetting
Feature: ProviderStandards
Doc Type: current-contract

Status: Current
Owner: runtime
Last verified: 2026-06-24

## 单点真相范围

这页文档统一说明 provider 接入时优先对齐哪些官方 API 标准，以及项目内部默认应该按哪套上游契约理解各个服务商。

相关概念：

- [[CONCEPT_RUNTIME]]
- [[CONCEPT_PLATFORM]]
- [[maps/AREA_MAP_RUNTIME]]

## 官方参考

做 provider integration 时，优先参考这些官方文档：

- OpenAI API Reference: https://platform.openai.com/docs/api-reference
- Cloudflare Workers AI OpenAI compatibility: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- LM Studio Developer Docs: https://lmstudio.ai/docs/developer
- LM Studio OpenAI compatibility: https://lmstudio.ai/docs/developer/openai-compat
- Ollama API Introduction: https://docs.ollama.com/api/introduction
- Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility

## 项目里的默认对齐方式

当前项目里的 provider integration，默认按最接近的官方标准对齐：

- `openai`：OpenAI API Reference
- `cloudflare`：Cloudflare Workers AI 的 OpenAI-compatible endpoint
- `lmstudio`：本地 OpenAI-compatible server API
- `ollama`：Ollama 原生 API，加上它的 OpenAI-compatible endpoint
- `volcengine`：除非某条路由明确写了不同契约，否则默认按 OpenAI-compatible request / response shape 理解

## 使用原则

- 先看官方文档，再看本地实现，不要反过来用当前实现猜测上游标准。
- 同属 OpenAI-compatible 的 provider，优先复用同一套请求 / 响应心智。
- 如果本地实现为了兼容某个 provider 偏差而特判，应该在对应实现或契约页里单独写清楚，不要默默扩散成“默认规则”。
