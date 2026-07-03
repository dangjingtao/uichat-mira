# 服务商接入优化说明

Layer: raw-source
Module: ModelSetting
Feature: ProviderIntegration
Doc Type: design

Status: Current
Owner: runtime
Last verified: 2026-06-24

## 目的

说明当前项目如何把 provider 接入从“到处补枚举和分支”收口成少量集中配置，降低新增服务商时的重复改动和漏改风险。

相关文档：

- [[provider-api-standards]]
- [[provider-proxy-api]]
- [[README]]

## 背景

在这次重构前，新增一个模型服务商通常需要同时修改这些位置：

- 后端路由 schema 中的 provider 枚举
- 后端数据库初始化 SQL 中的 provider 枚举
- 后端默认服务商连接配置
- 模型同步逻辑中的分支判断
- Chat / Embedding 代理逻辑中的分支判断
- 前端 `ProviderCode` 类型
- 前端展示名称或默认选中逻辑

这会让“新增服务商”变成一件高重复、容易漏改的事情。

## 重构目标

把“服务商基础元数据”和“服务商能力分组”收敛到少量集中配置文件里，让新增服务商时优先改配置，而不是全局搜索枚举。

## 当前结构

### 官方 API 标准参考

当前项目的服务商接入，优先对齐这些官方文档：

- OpenAI API Reference: https://platform.openai.com/docs/api-reference
- Cloudflare Workers AI OpenAI-compatible endpoints: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- LM Studio Developer Docs: https://lmstudio.ai/docs/developer
- LM Studio OpenAI Compatibility: https://lmstudio.ai/docs/developer/openai-compat
- Ollama API Introduction: https://docs.ollama.com/api/introduction
- Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility

当前项目里的 OpenAI-compatible 服务商，包括 `openai`、`cloudflare`、`lmstudio`、`volcengine` 等，默认优先按 OpenAI 的请求与响应标准校验；Ollama 同时支持自身原生 API 和 OpenAI-compatible 接口。

### 后端集中配置

#### 1. Provider Code 常量

文件：

- `server/src/providers/codes.ts`

职责：

- 统一维护 `PROVIDER_CODE_VALUES`
- 统一维护 `PROVIDER_STATUS_VALUES`
- 为数据库 SQL 枚举生成字符串

#### 2. Provider Catalog

文件：

- `server/src/providers/catalog.ts`

职责：

- 统一维护服务商显示名
- 统一维护默认 `baseUrl`
- 统一维护模型同步适配器
- 统一维护 Chat 适配器
- 统一维护 Embedding 适配器
- 统一维护 Rerank 适配器
- 统一维护特殊规则，例如 callable model id 前缀

每个服务商现在通过一份定义描述，例如：

- `code`
- `displayName`
- `defaultBaseUrl`
- `syncAdapter`
- `chatAdapter`
- `embeddingAdapter`
- `rerankAdapter`
- `callableModelIdPrefix`（可选）

### 前端集中配置

文件：

- `desktop/src/shared/providerCatalog.ts`

职责：

- 统一维护前端 `ProviderCode`
- 统一维护默认平台
- 统一维护平台展示名称

## 本次重构覆盖点

### 路由 schema 不再各自维护 provider 枚举

这些文件改为复用集中定义：

- `server/src/routes/model-config.ts`
- `server/src/routes/provider-settings.ts`
- `server/src/routes/proxy-provider.ts`

### 数据库初始化 SQL 不再手写 provider 列表

文件：

- `server/src/db/model-config.db.ts`

现在通过 `PROVIDER_CODE_VALUES` 生成 SQL 中的 `CHECK (...)` 枚举列表，减少漏改风险。

### 默认服务商连接配置改为从 Catalog 派生

文件：

- `server/src/services/model-config.defaults.ts`
- `server/src/providers/catalog.ts`

现在默认服务商连接来自集中注册表，而不是在 defaults 文件里再写一份。

### 模型同步逻辑按“适配器类型”分发

文件：

- `server/src/services/provider-settings.service.ts`

之前是按具体 provider 名称分支：

- `ollama`
- `cloudflare`
- 其他走 OpenAI Compatible

现在改为按 `syncAdapter` 分发，更容易扩展同类服务商。

### Chat / Embedding 代理按“能力族”分发

文件：

- `server/src/services/provider-proxy.service.ts`

之前新增服务商时，往往还要继续在 `switch(providerCode)` 里加 case。

现在改为根据 catalog 中的：

- `chatAdapter`
- `embeddingAdapter`
- `rerankAdapter`

做分发。  
这意味着同属 OpenAI-compatible 的新平台，通常不需要再加新的 Chat / Embedding 业务分支。

Rerank 不从 `chatAdapter` 推断能力。当前只有明确声明 `rerankAdapter: "openai-compatible"` 的服务商会走 `/v1/rerank`；其他服务商即使 Chat 兼容 OpenAI，也不代表可用于 Rerank。

## 现在如何新增一个服务商

### 场景一：新增一个 OpenAI-compatible 平台

如果新增的是和 OpenAI / Cloudflare / LM Studio 这类接近的 provider，通常只需要：

1. 在 `server/src/providers/codes.ts` 里加入新的 provider code
2. 在 `server/src/providers/catalog.ts` 里补一条定义
3. 在 `desktop/src/shared/providerCatalog.ts` 里补一条前端展示定义

如果它复用的是现有：

- `syncAdapter: "openai-compatible"`
- `chatAdapter: "openai-compatible"`
- `embeddingAdapter: "openai-compatible"`
- `rerankAdapter: "none"`，或在明确支持 `/v1/rerank` 时使用 `"openai-compatible"`

那么通常不需要再改：

- provider settings service 的分支逻辑
- proxy service 的 chat / embedding 分支逻辑
- 各个 route schema 的 provider 枚举
- 数据库初始化 SQL 的 provider 枚举

### 场景二：新增一个特殊协议族服务商

如果新服务商既不是 Ollama，也不是 OpenAI-compatible，或者它虽然兼容但仍需要独立协议族，那么需要：

1. 先在 `catalog.ts` 里声明它的 adapter 类型
2. 再在对应 service 里补新的 adapter 实现

也就是说，后续扩展优先是：

- 先扩能力族
- 再让多个服务商复用同一能力族

而不是每来一个 provider 都复制一套分支。

## 推荐接入顺序

建议以后新增服务商都按下面顺序处理：

1. 先定义 code：`server/src/providers/codes.ts`
2. 再定义 catalog：`server/src/providers/catalog.ts`
3. 确认协议族：看是否能复用现有 adapter
4. 补前端展示：`desktop/src/shared/providerCatalog.ts`
5. 最后执行验证：`pnpm check`

## 这轮优化的收益

- 新增服务商时改动点更集中
- provider 枚举遗漏导致的 schema / serializer 错误概率更低
- 同类服务商可复用同一套代理逻辑
- 后端默认配置、路由 schema、数据库枚举来源更一致
- 前端类型和展示名称来源更清晰

## 验证方式

这轮重构后已通过：

```bash
pnpm check
```

如果后续变更涉及打包或运行时行为，再按项目规范继续执行：

```bash
pnpm build
pnpm package:electron:win
```
