---
status: current
priority: P1
owner: model-settings
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: ProviderInstanceArchitecture
doc_type: task-card
canonical: true
related:
  - docs/architecture/model-settings-roadmap.md
  - docs/project-control/model-settings-workboard.md
  - docs/project-control/tasks/modelset_T001-role-expansion.md
  - docs/project-control/tasks/modelset_T002-image-provider-adapters.md
  - server/src/providers/catalog.ts
  - server/src/db/schema.ts
  - server/src/services/provider-settings.service.ts
task_state: DONE
---

# modelset_T003 google and custom openai providers

## Target

增加：

- Google provider
- 用户自建多个 OpenAI-compatible 服务商实例

本任务是 provider 架构改造任务。核心目标是从固定 `providerCode` 演进到 provider template / provider connection instance 分层。

## Prerequisite

- `modelset_T001` 已完成。
- 若涉及 image capability，`modelset_T002` 的 image adapter contract 已确认。

## Allowed Changes

- `server/src/db/schema.ts`
- database migration / bootstrap files
- `server/src/providers/catalog.ts`
- `server/src/providers/codes.ts`
- `server/src/services/provider-settings.service.ts`
- `server/src/services/provider-proxy.service/*`
- `server/src/routes/provider-settings/*`
- `desktop/src/shared/api/modelSettings.ts`
- `desktop/src/shared/providerCatalog.ts`
- provider settings tests
- migration compatibility tests
- this task card and `docs/project-control/model-settings-workboard.md`

## Forbidden Changes

- 前端大规模 UI 重排，除非是支持新数据合同的最小改动。
- 删除旧 providerCode 数据。
- 把 integration provider 表复用为 model provider。
- 把用户自建 provider 写成新增静态枚举。
- Agent graph 改造。
- 生图 adapter 重写。

## Invariants

1. 一个用户可以创建多个 OpenAI-compatible 服务商实例。
2. provider template 表示协议能力，connection instance 表示真实连接。
3. 模型默认绑定应指向 connection instance，而不是只指向静态 provider code。
4. 旧 provider 配置必须可迁移或兼容读取。
5. 固定内置服务商仍可作为默认 connection 初始化。
6. API 不得泄露加密后的 API key。

## Proposed Storage Direction

目标结构：

```text
provider_templates
  code
  displayName
  adapters
  defaultBaseUrl

provider_connections
  id
  templateCode
  displayName
  baseUrl
  apiKeyEncrypted
  status
  enabled

provider_models
  providerConnectionId
  remoteModelId
  modelName
  rawPayloadJson

model_configs
  providerConnectionId
  remoteModelId
```

过渡期可以保留 `providerCode` 字段，但新逻辑必须优先使用 `providerConnectionId`。

## Implementation Plan

1. 设计并实现 provider template / connection instance 数据结构。
2. 增加旧 providerCode 到新 connection 的迁移或 bootstrap。
3. 增加 custom OpenAI-compatible provider CRUD。
4. 增加 Google provider adapter。
5. 修改 provider model sync，使其按 connection instance 同步。
6. 修改 model role assignment，使其绑定 connection instance。
7. 保持旧 API 的兼容层或明确更新前端调用。
8. 补迁移测试、provider sync 测试、role assignment 测试。

## Acceptance Criteria

- 可以创建两个不同的 OpenAI-compatible provider connection。
- 两个 connection 可以分别同步模型。
- 任意模型角色可以绑定到其中一个 connection 的模型。
- Google provider 可以保存配置并同步模型。
- 旧内置 provider 配置不丢失。
- 旧模型绑定有可验证迁移路径。

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- <provider migration/settings tests>`
- `pnpm --filter @ui-chat-mira/desktop typecheck`
- `pnpm --filter @ui-chat-mira/desktop test -- <provider settings UI tests>`
- 涉及数据库迁移时跑一次干净库 bootstrap 检查。

## Evidence Requirements

完成后必须在本卡记录：

- 旧数据迁移说明
- 自定义 OpenAI-compatible 双实例验证
- Google provider 同步验证
- API response 样例
- 测试命令和结果

## Risks

- 这是本路线图风险最高任务。
- 如果没有兼容层，旧库会出现 provider binding 丢失。
- 如果继续用静态枚举表达自建服务商，会违背本任务目标。

## Completion Evidence

### Changed Files

- `server/src/providers/codes.ts`
- `server/src/providers/catalog.ts`
- `server/src/db/schema.ts`
- `server/src/db/model-config.db.ts`
- `server/src/db/repositories/provider-settings.repository.ts`
- `server/src/db/repositories/model-config.repository.ts`
- `server/src/services/provider-settings.service.ts`
- `server/src/services/provider-settings.service.test.ts`
- `server/src/services/provider-proxy.service/resolution.ts`
- `server/src/services/provider-proxy.service/types.ts`
- `server/src/services/model-config.service.ts`
- `server/src/services/openai-compatible-provider.ts`
- `server/src/routes/model-config.ts`
- `server/src/routes/provider-settings/connections.routes.ts`
- `server/src/routes/provider-settings/models.routes.ts`
- `server/src/routes/provider-settings/assignments.routes.ts`
- `server/src/routes/provider-settings/types.ts`
- `server/src/routes/provider-settings/schemas.ts`
- `desktop/src/shared/providerCatalog.ts`
- `desktop/src/shared/api/modelSettings.ts`
- `desktop/src/shared/api/__tests__/modelSettings.test.ts`
- `docs/project-control/model-settings-workboard.md`
- `docs/project-control/tasks/modelset_T003-google-and-custom-openai-providers.md`

### Legacy Data Migration

- `provider_connections` 已从 `provider_code` 主键迁移为 `id` 主键。
- 内置服务商 bootstrap 时固定使用：
  - `id = providerCode`
  - `templateCode = providerCode`
  - `providerCode = providerCode`
- `provider_models` 新增 `provider_connection_id`，迁移时把旧 `provider_code` 回填为对应内置 connection id。
- `model_configs` 新增 `provider_connection_id`，迁移时对旧默认绑定执行：
  - `provider_connection_id = provider_code`
- 过渡期仍保留 `provider_code` 字段。
- 新逻辑优先使用 `providerConnectionId`，旧 `providerCode` 只保留兼容读取与 builtin alias 语义。

### Custom OpenAI-Compatible Dual Instance Verification

后端测试已验证：

- 可以创建两个 `templateCode = openai-compatible-custom` 的 connection。
- 两个 connection 拥有不同 `id`。
- 两个 connection 可以分别写入各自的模型缓存。
- 角色绑定可指向其中一个 connection，并在返回值中带出：
  - `providerConnectionId`
  - `providerTemplateCode`
  - 兼容字段 `providerCode`

### Google Provider Verification

后端测试已验证：

- `google` 作为内置 template / builtin connection 可保存配置。
- `syncProviderModels("google")` 会按 Google OpenAI-compatible 路径走模型同步。
- mock 结果已覆盖 `gemini-2.5-flash` 的同步返回。

### API Response Samples

`GET /providers`

```json
[
  {
    "id": "openai",
    "code": "openai",
    "templateCode": "openai",
    "providerCode": "openai",
    "displayName": "OpenAI",
    "baseUrl": "https://api.openai.com/v1",
    "hasApiKey": true,
    "status": "connected",
    "lastError": null,
    "lastSyncedAt": "2026-07-06T12:00:00.000Z",
    "assignedRoles": ["llm"],
    "isSystem": true,
    "capabilities": {
      "syncAdapter": "openai-compatible",
      "chatAdapter": "openai-compatible",
      "embeddingAdapter": "openai-compatible",
      "rerankAdapter": "none",
      "imageAdapter": "openai-images",
      "supportsRoles": ["llm", "task", "agentTask", "evaluation", "embedding", "imageGeneration"]
    }
  }
]
```

`GET /providers/:id`

```json
{
  "provider": {
    "id": "custom-openai-1",
    "code": "custom-openai-1",
    "templateCode": "openai-compatible-custom",
    "providerCode": null,
    "displayName": "Custom A",
    "baseUrl": "https://a.example.com/v1",
    "apiKey": "sk-***",
    "hasApiKey": true,
    "status": "connected",
    "lastError": null,
    "lastSyncedAt": "2026-07-06T12:00:00.000Z",
    "isSystem": false
  },
  "models": [
    {
      "id": "model-a",
      "name": "Model A"
    }
  ],
  "assignments": {
    "llm": {
      "providerCode": "custom-openai-1",
      "providerConnectionId": "custom-openai-1",
      "providerTemplateCode": "openai-compatible-custom",
      "remoteModelId": "model-a",
      "modelName": "Model A"
    }
  }
}
```

### Verification Results

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 通过
- `pnpm --filter @ui-chat-mira/server test -- src/services/provider-settings.service.test.ts src/services/provider-proxy.service/resolution.test.ts src/providers/catalog.test.ts`
  - 通过
- `pnpm --filter @ui-chat-mira/desktop typecheck`
  - 通过
- `pnpm --filter @ui-chat-mira/desktop test -- src/shared/api/__tests__/modelSettings.test.ts`
  - 通过
- `pnpm check`
  - 通过
