---
status: current
priority: P1
owner: model-settings
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: ImageProviderAdapters
doc_type: task-card
canonical: true
related:
  - docs/architecture/model-settings-roadmap.md
  - docs/project-control/model-settings-workboard.md
  - docs/project-control/tasks/modelset_T001-role-expansion.md
  - server/src/services/provider-proxy.service/index.ts
  - server/src/services/openai-compatible-provider.ts
  - server/src/providers/catalog.ts
task_state: TODO
---

# modelset_T002 image provider adapters

## Target

为 `imageGeneration` 角色接入真实生图能力。

第一版支持：

- OpenAI Images
- ComfyUI

本任务要求建立独立 image adapter，不允许把生图伪装成 chat completion。

## Prerequisite

- `modelset_T001` 已完成。
- `imageGeneration` 角色已存在并可绑定默认模型。

## Allowed Changes

- `server/src/providers/catalog.ts`
- `server/src/services/provider-proxy.service/*`
- `server/src/services/openai-compatible-provider.ts`
- new image generation service files under `server/src/services/`
- image generation route files if needed
- `desktop/src/shared/api/*` for image generation request contract if needed
- tests for image adapter and route behavior
- docs for image generation request / response protocol
- this task card and `docs/project-control/model-settings-workboard.md`

## Forbidden Changes

- 自定义 OpenAI-compatible provider CRUD
- Google provider
- provider connection 主键重构
- 前端模型设置大改
- Agent graph 改造
- RAG / embedding / rerank 协议改动

## Invariants

1. 生图调用必须使用 `imageGeneration` 默认模型。
2. 生图 adapter 独立于 chat adapter。
3. OpenAI Images 与 ComfyUI 的请求参数必须在 adapter 边界内转换。
4. 失败必须返回明确错误，不得影响普通聊天。
5. 生图输出不得直接写入不稳定临时目录作为长期引用。

## Proposed Contract

最小输入：

```ts
{
  prompt: string;
  negativePrompt?: string;
  size?: string;
  n?: number;
  seed?: number;
  workflow?: unknown;
}
```

最小输出：

```ts
{
  providerCode: string;
  model: string;
  images: Array<{
    mimeType: string;
    url?: string;
    b64Json?: string;
    fileId?: string;
  }>;
}
```

## Implementation Plan

1. 在 provider catalog 中增加 image adapter 能力字段。
2. 新增 OpenAI Images adapter。
3. 新增 ComfyUI adapter。
4. 新增 `generateImageForRole("imageGeneration", input)` 服务入口。
5. 增加最小 route 或内部 service 调用入口。
6. 补 adapter 单测和错误场景测试。

## Acceptance Criteria

- OpenAI Images 最小 prompt 可生成响应。
- ComfyUI baseUrl 可配置并执行最小 workflow。
- 未配置 `imageGeneration` 时返回明确错误。
- provider 不支持 image adapter 时返回明确错误。
- 普通 chat / task / embedding / rerank 测试不受影响。

## Verification

- `pnpm --filter @ui-chat-mira/server typecheck`
- `pnpm --filter @ui-chat-mira/server test -- <image provider adapter tests>`
- 如新增前端 API，跑对应 desktop typecheck/test

## Evidence Requirements

完成后必须在本卡记录：

- OpenAI Images smoke 结果或 mock 证据
- ComfyUI smoke 结果或 mock 证据
- 错误场景测试结果
- 输出存储位置说明

## Risks

- ComfyUI workflow 参数差异大，第一版必须保持最小协议。
- 不同 provider 的 image 返回格式不同，不能把 URL / b64 / 文件引用混成一个不透明字符串。
- 生图结果持久化位置需要避免使用 `.artifacts/` 作为长期引用。
