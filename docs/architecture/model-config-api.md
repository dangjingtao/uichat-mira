# 模型配置 API

Status: Current
Owner: runtime
Last verified: 2026-06-26
Layer: raw-source
Module: ModelSetting
Feature: ModelConfig
Doc Type: reference

## 单点真相范围

这页文档统一说明模型配置相关 backend route 的调用方式和路由范围。

相关文档：

- [[api-response-spec]]
- [[provider-api-standards]]
- [[maps/AREA_MAP_RUNTIME]]

## 基础地址

统一使用 `runtime.config.cjs` 里定义的 backend origin：

```text
http://<backend-host>:<backend-port>
```

开发态 renderer 通过 Vite proxy 调用这些路由：

```text
/api/models -> backend /models
```

生产态 renderer 直接通过 `window.desktopApi.backendUrl` 调用：

```text
${window.desktopApi.backendUrl}/models
```

## 路由列表

### 读取默认模型配置

```http
GET /models
```

### 按类型读取默认配置

```http
GET /models/:type/config
```

`type` 可选：

- `llm`
- `embedding`
- `rerank`

`rerank` 是可选能力。当默认 rerank 配置已启用，且同时存在 `providerCode` 与 `remoteModelId` 时，RAG pipeline 才会在 rerank node 中使用它；否则会回落为原始 retrieval-score 排序。

示例：

```bash
curl http://<backend-host>:<backend-port>/models/llm/config
```

### 按类型更新默认配置

```http
PUT /models/:type/config
```

示例：

```bash
curl -X PUT http://<backend-host>:<backend-port>/models/llm/config \
  -H "Content-Type: application/json" \
  -d '{"params":{"temperature":0.9}}'
```

### 读取参数模板

```http
GET /models/param-templates
GET /models/param-templates?type=llm
```

### 列出模型配置

```http
GET /models/configs
GET /models/configs?type=llm
```

### 创建模型配置

```http
POST /models/configs
```

示例：

```bash
curl -X POST http://<backend-host>:<backend-port>/models/configs \
  -H "Content-Type: application/json" \
  -d '{"type":"llm","name":"test-model","params":{"enabled":true}}'
```

### 删除模型配置

```http
DELETE /models/configs/:id
```

## 前端调用规则

前端统一使用 `desktop/src/shared/lib/request.ts`，不要手动拼 URL。

开发态：

```text
baseURL = /api
```

生产态：

```text
baseURL = window.desktopApi.backendUrl
```

所以 feature 代码里应只写路由 path：

```ts
get("/models");
put("/models/llm/config", payload);
```
