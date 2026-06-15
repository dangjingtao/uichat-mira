# Model Config API

This document describes backend routes. Backend routes do not include the development `/api` proxy prefix.

## Base URL

Use the backend origin from `runtime.config.cjs`:

```text
http://<backend-host>:<backend-port>
```

In development renderer code, call these routes through Vite proxy with `/api`:

```text
/api/models -> backend /models
```

In production renderer code, call the backend origin directly through `window.desktopApi.backendUrl`:

```text
${window.desktopApi.backendUrl}/models
```

## Routes

### Get Default Model Configs

```http
GET /models
```

### Get Default Config By Type

```http
GET /models/:type/config
```

`type` can be `llm`, `embedding`, or `rerank`.

`rerank` is optional. When the default rerank config is enabled and has both
`providerCode` and `remoteModelId`, the RAG pipeline will use it during the
rerank node; otherwise the pipeline falls back to raw retrieval-score sorting.

Example:

```bash
curl http://<backend-host>:<backend-port>/models/llm/config
```

### Update Default Config By Type

```http
PUT /models/:type/config
```

Example:

```bash
curl -X PUT http://<backend-host>:<backend-port>/models/llm/config \
  -H "Content-Type: application/json" \
  -d '{"params":{"temperature":0.9}}'
```

### Get Parameter Templates

```http
GET /models/param-templates
GET /models/param-templates?type=llm
```

### List Model Configs

```http
GET /models/configs
GET /models/configs?type=llm
```

### Create Model Config

```http
POST /models/configs
```

Example:

```bash
curl -X POST http://<backend-host>:<backend-port>/models/configs \
  -H "Content-Type: application/json" \
  -d '{"type":"llm","name":"test-model","params":{"enabled":true}}'
```

### Delete Model Config

```http
DELETE /models/configs/:id
```

## Frontend Usage

Use `desktop/src/shared/lib/request.ts` helpers instead of constructing URLs manually.

Development behavior:

```text
baseURL = /api
```

Production behavior:

```text
baseURL = window.desktopApi.backendUrl
```

That means feature code should call route paths without environment-specific prefixes:

```typescript
get("/models");
put("/models/llm/config", payload);
```
