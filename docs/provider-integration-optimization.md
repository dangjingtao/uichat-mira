# 服务商接入优化说明

Status: Historical
Owner: runtime
Last verified: 2026-06-26
Layer: wiki
Module: provider
Doc Type: historical

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

把“服务商的基础元数据”和“服务商能力分组”收敛到少量集中配置文件中，让新增服务商时优先改配置，而不是全局搜索枚举。

## 现在的结构

### 服务商官方 API 标准参考

当前项目的服务商接入，优先对齐这些官方文档：

- OpenAI API Reference: https://platform.openai.com/docs/api-reference
- Cloudflare Workers AI OpenAI-compatible endpoints: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- LM Studio Developer Docs: https://lmstudio.ai/docs/developer
- LM Studio OpenAI Compatibility: https://lmstudio.ai/docs/developer/openai-compat
- Ollama API Introduction: https://docs.ollama.com/api/introduction
- Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility

当前项目里的 OpenAI-compatible 服务商，包括 `openai`、`cloudflare`、`lmstudio`、`volcengine` 等，默认优先按照 OpenAI 的请求和响应标准校验；Ollama 同时支持自身原生 API 和 OpenAI-compatible 接口。

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
- 统一维护特殊规则（例如 callable model id 前缀）

每个服务商现在通过一份定义描述，例如：

- `code`
- `displayName`
- `defaultBaseUrl`
- `syncAdapter`
- `chatAdapter`
- `embeddingAdapter`
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

之前新增服务商时，往往要继续在 `switch(providerCode)` 里加 case。

现在改为根据 catalog 中的：

- `chatAdapter`
- `embeddingAdapter`

进行分发。  
这意味着同属 OpenAI Compatible 的新平台，通常不需要再加新的业务分支。

## 现在如何新增一个服务商

### 场景一：只是新增一个 OpenAI Compatible 平台

比如新增一个和 OpenAI / OpenAI兼容服务商 / LM Studio 类似的 provider。

通常只需要：

1. 在 `server/src/providers/codes.ts` 里加入新的 provider code
2. 在 `server/src/providers/catalog.ts` 里补一条定义
3. 在 `desktop/src/shared/providerCatalog.ts` 里补一条前端展示定义

如果它走的是现有的：

- `syncAdapter: "openai-compatible"`
- `chatAdapter: "openai-compatible"`
- `embeddingAdapter: "openai-compatible"`

那么通常**不需要**再改：

- provider settings service 的分支逻辑
- proxy service 的 chat / embedding 分支逻辑
- 各个路由 schema 的 provider 枚举
- 数据库初始化 SQL 的 provider 枚举

### 场景二：新增一个特殊协议族服务商

如果新服务商不是 Ollama，也不是 OpenAI Compatible，也不是 Cloudflare 这类已支持协议族，那么需要：

1. 在 `catalog.ts` 里先声明它的 adapter 类型
2. 在对应 service 里补充新的 adapter 实现

也就是说，未来扩展优先是：

- 先扩能力族
- 再让多个服务商复用这个能力族

而不是每来一个 provider 都复制一套分支。

## 推荐的后续接入规范

建议以后新增服务商时按下面顺序处理：

1. **先定义 code**：`server/src/providers/codes.ts`
2. **再定义 catalog**：`server/src/providers/catalog.ts`
3. **确认协议族**：是否能复用已有 adapter
4. **补前端展示**：`desktop/src/shared/providerCatalog.ts`
5. **最后验证**：`pnpm check`

## 本次优化收益

- 新增服务商时改动点更集中
- 枚举遗漏导致的 schema / serializer 错误概率更低
- 同类服务商可复用同一套代理逻辑
- 后端默认配置、路由 schema、数据库枚举更一致
- 前端类型和展示名来源更清晰

## 验证方式

本次重构后，已通过：

```bash
pnpm check
```

如果后续涉及打包或运行时行为变更，再按项目规范继续执行：

```bash
pnpm build
pnpm package:electron:win
```
