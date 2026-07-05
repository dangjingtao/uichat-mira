---
status: current
priority: P1
owner: microapp
last_verified: 2026-07-06
layer: project-control
module: MicroAPP
feature: ImageGeneration
doc_type: task-card
canonical: true
related:
  - docs/project-control/tasks/microapp_T010-image-generation-parallel-code-isolation.md
  - docs/microapp/image-generation-microapp-poc.md
  - docs/architecture/README.md
task_state: TODO
---

# microapp_T104 Image Generation Desktop API Client

## Target

实现 desktop 端访问 `image_generation` backend route 的共享 API client。

本卡只负责请求函数、前端类型和共享导出，不做页面状态和界面渲染。

## Allowed Changes

- `desktop/src/shared/api/imageGeneration.ts`
- `desktop/src/shared/api/index.ts`
- `desktop/src/shared/api/imageGeneration.test.ts`
- `docs/project-control/tasks/microapp_T104-image-generation-desktop-api-client.md`

## Forbidden Changes

- `desktop/src/features/**`
- `desktop/src/app/routes/**`
- `server/**`
- `electron/**`
- `tauri/**`

## Code Placement

- 所有 `image_generation` HTTP 调用统一放到 `desktop/src/shared/api/imageGeneration.ts`
- 对外 re-export 只放到 `desktop/src/shared/api/index.ts`

## Acceptance Criteria

1. 所有请求都通过现有 request helper 发往 backend route，不在页面层直接写 URL。
2. API client 不 import React、i18n、toast message、组件或页面代码。
3. API client 暴露的类型和方法足以支持“提交任务”和“查询任务”。
4. 定向测试覆盖路径拼接和基础参数传递。
5. 不修改 forbidden area。

## Verification

- `pnpm --filter @ui-chat-mira/desktop exec vitest run src/shared/api/imageGeneration.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 API client 路径和参数
- `rg -n "from \\\"react\\\"|from \\\"react-i18next\\\"|message\\." desktop/src/shared/api/imageGeneration.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查 API client 没有混入 UI 依赖
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Evidence

- Changed files:
  - `desktop/src/shared/api/imageGeneration.ts`
  - `desktop/src/shared/api/index.ts`
  - `desktop/src/shared/api/imageGeneration.test.ts`

- Acceptance evidence placeholder:
  - 等实现线程回填

## Isolation Rules

- 本卡是唯一允许修改 `desktop/src/shared/api/index.ts` 的 image generation 线程。
- 页面线程只能 import 本卡导出的 API client，不能自己绕过共享层直接请求 backend。

