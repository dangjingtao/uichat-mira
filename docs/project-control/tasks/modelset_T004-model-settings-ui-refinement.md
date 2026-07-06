---
status: current
priority: P2
owner: model-settings
last_verified: 2026-07-06
layer: project-control
module: ProjectControl
feature: ModelSettingsUiRefinement
doc_type: task-card
canonical: true
related:
  - docs/architecture/model-settings-roadmap.md
  - docs/project-control/model-settings-workboard.md
  - docs/project-control/tasks/modelset_T001-role-expansion.md
  - docs/project-control/tasks/modelset_T002-image-provider-adapters.md
  - docs/project-control/tasks/modelset_T003-google-and-custom-openai-providers.md
  - desktop/src/features/Settings/pages/ModelSetting/index.tsx
  - desktop/src/features/Settings/components/PlatformConfigModal.tsx
  - desktop/src/features/Settings/components/ModelConfig.tsx
task_state: DONE
---

# modelset_T004 model settings ui refinement

## Target

重整模型设置前端体验，让用户能清楚区分：

- 服务商连接
- 模型同步
- 默认角色模型绑定
- 内置本地模型

本任务默认在 `modelset_T001` 至 `modelset_T003` 的数据合同稳定后执行。

## Allowed Changes

- `desktop/src/features/Settings/pages/ModelSetting/*`
- `desktop/src/features/Settings/components/DefaultModelCard.tsx`
- `desktop/src/features/Settings/components/ModelConfig.tsx`
- `desktop/src/features/Settings/components/PlatformConfigModal.tsx`
- `desktop/src/features/Settings/components/ApiConfigCard.tsx`
- `desktop/src/shared/api/modelSettings.ts`
- `desktop/src/shared/i18n/*`
- `desktop/src/features/Settings/i18n/*`
- source-adjacent UI docs if shared component behavior changes
- related frontend tests
- this task card and `docs/project-control/model-settings-workboard.md`

## Forbidden Changes

- 后端 provider adapter 新增
- 数据库迁移
- provider template / connection instance 合同变更
- 生图调用协议变更
- Agent graph 变更
- 大范围重做设置页导航

## Invariants

1. 前端只消费后端稳定 API，不在 UI 层猜 provider 能力。
2. 服务商连接与默认角色绑定必须分区展示。
3. 内置本地模型不得显示成服务商已配置。
4. 角色按钮必须数据驱动，避免新增角色时继续手写遗漏。
5. UI 不得把生图参数和 chat 参数混在同一组控件里。

## Proposed UI Direction

模型设置页分组：

```text
Default Role Models
  Chat
  Agent / Task
  Knowledge Base
  Evaluation
  Image Generation

Provider Connections
  Built-in providers
  Custom providers
```

服务商详情分区：

```text
Connection
  display name
  base URL
  API key

Capabilities
  chat
  embedding
  rerank
  image

Synced Models
  select model
  assign to role
```

## Implementation Plan

1. 抽出统一角色元数据表，前端按角色表渲染卡片和绑定按钮。
2. 默认模型卡按业务用途分组。
3. provider modal 左侧支持内置 / 自定义分组。
4. provider detail 展示 capability badges。
5. 生图模型卡使用生图专属参数展示。
6. 保留现有操作入口，避免用户找不到原来的模型设置。
7. 补前端渲染与交互测试。

## Acceptance Criteria

- 新增角色不需要手写多个按钮。
- 用户能看到每个服务商支持哪些能力。
- 自定义服务商与内置服务商视觉上可区分。
- 默认模型绑定状态清晰展示。
- 内置本地模型与服务商模型状态清楚分离。
- 移动/窄屏不出现文字重叠或按钮溢出。

## Verification

- `pnpm --filter @ui-chat-mira/desktop typecheck`
- `pnpm --filter @ui-chat-mira/desktop test -- <model settings UI tests>`
- 必要时启动前端并用 Browser/截图检查模型设置页

## Evidence Requirements

完成后必须在本卡记录：

- UI 改造前后入口说明
- 关键截图或截图路径
- 测试命令和结果
- 已验证的窄屏/普通桌面视口

## Completion Evidence

### UI 改造前后入口说明

- 改造前：模型设置页把默认角色模型、服务商配置、模型同步和角色绑定混在一套入口里，用户进入 `模型设置` 后需要在单张配置视图里自行区分“这是连接信息”还是“这是默认角色绑定”。
- 改造后：`模型设置` 页保留原有导航入口不变，顶部右侧仍然是 `模型设置` 按钮；主页面先按业务用途展示默认角色模型分组，弹窗内再把服务商连接拆成“内置服务商 / 自定义服务商”左侧列表，右侧独立展示连接信息、能力标签、同步模型和默认角色绑定。
- 备份路径：`D:\workspace\rag-demo\.test-artifact\modelset_T004-ui-backup-20260706-200121`

### 关键截图

- 普通桌面主页面：`D:\workspace\rag-demo\.test-artifact\modelset_T004-screenshots\model-settings-desktop-main.png`
- 普通桌面服务商弹窗：`D:\workspace\rag-demo\.test-artifact\modelset_T004-screenshots\model-settings-desktop-modal.png`
- 窄屏主页面：`D:\workspace\rag-demo\.test-artifact\modelset_T004-screenshots\model-settings-narrow-main.png`
- 窄屏服务商弹窗：`D:\workspace\rag-demo\.test-artifact\modelset_T004-screenshots\model-settings-narrow-modal.png`

### 测试命令和结果

- `pnpm --filter @ui-chat-mira/desktop typecheck`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/desktop test -- src/features/Settings/components/DefaultModelCard.test.tsx src/features/Settings/components/ApiConfigCard.test.tsx src/features/Settings/components/PlatformConfigModal.test.tsx`
  - 结果：通过
- `pnpm check`
  - 结果：通过，覆盖 workspace typecheck

### 视口检查结果

- 普通桌面视口：使用 `1440x1200` 检查主页面和服务商弹窗，默认角色分组、按钮、服务商分栏和能力标签未出现文字重叠。
- 窄屏视口：使用 `900x1400` 检查主页面，角色卡片改为更紧凑排布，顶部操作按钮未溢出；使用 `900x1200` 检查服务商弹窗，左侧服务商列表和底部操作按钮未溢出，右侧详情区收窄后仍保持弹窗内部滚动，不与页外区域重叠。

## Risks

- 如果在 `T003` 前启动大改，UI 很可能围绕旧 providerCode 合同返工。
- 若角色元数据不集中，后续新增模型角色仍会重复遗漏。
- 生图模型参数如果复用 chat 参数，会误导用户。
