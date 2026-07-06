---
status: current
priority: P1
owner: model-settings
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: ModelRoleExpansion
doc_type: task-card
canonical: true
related:
  - docs/architecture/model-settings-roadmap.md
  - docs/project-control/model-settings-workboard.md
  - server/src/constants/domain.ts
  - server/src/db/schema.ts
  - server/src/services/model-config.defaults.ts
  - server/src/services/provider-settings.service.ts
  - server/src/services/provider-proxy.service/index.ts
  - server/src/services/provider-proxy.service/resolution.ts
  - desktop/src/shared/api/modelSettings.ts
  - desktop/src/features/Settings/components/ModelConfig.tsx
  - desktop/src/features/Settings/components/ApiConfigCard.tsx
task_state: DONE
---

# modelset_T001 role expansion

## Target

新增两个模型角色：

- `agentTask`
- `imageGeneration`

让现有服务商已同步的模型可以被设置为默认 AgentTask 模型和默认生图模型。

本任务只做角色扩展，不做新 provider adapter，不做自定义服务商实例。

## Allowed Changes

- `server/src/constants/domain.ts`
- `server/src/db/schema.ts`
- `server/src/services/model-config.defaults.ts`
- `server/src/services/model-config.service.ts`
- `server/src/services/provider-settings.service.ts`
- `server/src/services/provider-proxy.service/index.ts`
- `server/src/services/provider-proxy.service/resolution.ts`
- `server/src/db/model-config.db.ts`
- `server/src/routes/schema-helpers.ts`
- `server/src/routes/model-config.ts`
- `server/src/routes/provider-settings/*`
- `desktop/src/shared/api/modelSettings.ts`
- `desktop/src/features/Settings/components/ModelConfig.tsx`
- `desktop/src/features/Settings/components/ApiConfigCard.tsx`
- `desktop/src/features/Settings/components/DefaultModelCard.tsx`
- `desktop/src/shared/i18n/*`
- relevant tests for the above files
- this task card and `docs/project-control/model-settings-workboard.md`

## Forbidden Changes

- 自定义 OpenAI-compatible 服务商 CRUD
- Google provider
- OpenAI Images / ComfyUI 真实调用
- provider storage 主键重构
- provider template / connection instance 分层
- chat route 大改
- Agent graph 结构重写
- 删除或重命名现有 `task` 角色

## Invariants

1. 现有 `llm / task / evaluation / embedding / rerank` 行为不得改变。
2. `agentTask` 是 Agent 专用任务模型，不得替代已有 `task`。
3. `imageGeneration` 第一版只要求可绑定默认模型，不要求真实生图调用。
4. provider 仍使用现有 `providerCode` 架构。
5. reset / select / list provider detail 必须包含全部角色。
6. 旧数据库启动时必须能补齐新增默认配置。

## Implementation Plan

1. 扩展后端模型角色枚举。
2. 为 `agentTask` 和 `imageGeneration` 增加默认参数。
3. provider settings response 的 assignments 增加两个角色。
4. 前端 `RoleModelType` 增加两个角色。
5. 模型设置页新增两张角色卡。
6. 平台模型设置新增两个角色绑定入口。
7. Agent 任务模型读取入口新增 `agentTask`，但保留兼容 fallback 到 `task` 的设计需要先在代码注释或测试中明确。
8. 补充后端和前端定向测试。

## Acceptance Criteria

- `/models` 返回包含 `agentTask` 和 `imageGeneration` 的默认配置。
- `/providers/:providerCode` 的 `assignments` 包含两个新角色。
- 用户可把已有服务商模型设置为默认 AgentTask。
- 用户可把已有服务商模型设置为默认 ImageGeneration。
- 模型设置页能看到两个新角色卡。
- 未配置新角色不影响现有聊天、知识库、评测功能。

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- <provider-settings and model-config tests>`
- `pnpm --filter @ui-chat-mira/desktop typecheck`
- `pnpm --filter @ui-chat-mira/desktop test -- <model settings tests>`
- 如改动触及 shared route schema，补跑 `pnpm check`

## Evidence Requirements

完成后必须在本卡记录：

- 变更文件列表
- 新增角色在 API response 中的样例
- 前端设置页可见性验证
- 测试命令和结果

## Risks

- SQLite enum 约束或迁移脚本遗漏会导致旧库无法写入新角色。
- 前端角色按钮如果继续手写，容易漏掉新角色。
- Agent 切到 `agentTask` 后，如果用户未配置，会影响 Agent 可用性；必须有明确 fallback 或明确错误。

## Completion Evidence

### Changed Files

- `server/src/constants/domain.ts`
- `server/src/db/schema.ts`
- `server/src/db/model-config.db.ts`
- `server/src/services/model-config.defaults.ts`
- `server/src/services/model-config.service.ts`
- `server/src/services/provider-settings.service.ts`
- `server/src/services/provider-proxy.service/index.ts`
- `server/src/services/provider-proxy.service/resolution.ts`
- `server/src/routes/model-config.ts`
- `server/src/routes/provider-settings/schemas.ts`
- `server/src/services/provider-settings.service.test.ts`
- `server/src/services/provider-proxy.service/resolution.test.ts`
- `desktop/src/shared/api/modelSettings.ts`
- `desktop/src/app/providers/RoleModelConfigProvider.tsx`
- `desktop/src/features/Settings/components/ModelConfig.tsx`
- `desktop/src/features/Settings/components/ApiConfigCard.tsx`
- `desktop/src/features/Settings/components/DefaultModelCard.tsx`
- `desktop/src/features/Settings/components/ApiConfigCard.test.tsx`
- `desktop/src/features/Settings/components/DefaultModelCard.test.tsx`
- `desktop/src/shared/i18n/zh-CN.ts`
- `desktop/src/shared/i18n/en-US.ts`
- `docs/project-control/model-settings-workboard.md`
- `docs/project-control/tasks/modelset_T001-role-expansion.md`

### API Response Samples

`GET /models` 默认配置现在会包含：

```json
[
  {
    "type": "agentTask",
    "providerCode": null,
    "remoteModelId": null,
    "params": {
      "enabled": true,
      "temperature": 0,
      "topP": 1,
      "topK": 20,
      "maxTokens": 128,
      "frequencyPenalty": 0,
      "presencePenalty": 0
    }
  },
  {
    "type": "imageGeneration",
    "providerCode": null,
    "remoteModelId": null,
    "params": {
      "enabled": true
    }
  }
]
```

`GET /providers/:providerCode` 的 `assignments` 现在会包含：

```json
{
  "assignments": {
    "llm": null,
    "embedding": null,
    "rerank": null,
    "task": null,
    "agentTask": {
      "providerCode": "ollama",
      "remoteModelId": "qwen-agent",
      "modelName": "qwen-agent"
    },
    "evaluation": null,
    "imageGeneration": {
      "providerCode": "ollama",
      "remoteModelId": "flux-image",
      "modelName": "flux-image"
    }
  }
}
```

### Frontend Visibility

- `DefaultModelCard` 已新增 `agentTask` 和 `imageGeneration` 两张角色卡。
- `ApiConfigCard` 的平台绑定按钮已从手写 5 个角色改为角色数组渲染，现可直接绑定：
  - `AgentTask`
  - `ImageGeneration`
- 前端定向测试已验证：
  - `DefaultModelCard` 能渲染两张新角色卡
  - `ApiConfigCard` 能触发 `agentTask` 与 `imageGeneration` 绑定动作

### Verification Results

- `pnpm --filter @ui-chat-mira/server typecheck`
  - 通过
- `pnpm --filter @ui-chat-mira/server test -- src/services/provider-settings.service.test.ts src/services/provider-proxy.service/resolution.test.ts`
  - 通过
- `pnpm --filter @ui-chat-mira/desktop typecheck`
  - 通过
- `pnpm --filter @ui-chat-mira/desktop test -- src/features/Settings/components/ApiConfigCard.test.tsx src/features/Settings/components/DefaultModelCard.test.tsx`
  - 通过
- `pnpm check`
  - 通过
