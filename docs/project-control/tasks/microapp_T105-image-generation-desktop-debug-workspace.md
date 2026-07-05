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
  - docs/microapp/image-generation-debug-workspace-interaction-spec.md
  - docs/uchat.md
task_state: DONE
---

# microapp_T105 Image Generation Desktop Debug Workspace

## Target

实现只服务微应用界面调试的 desktop 页面工作区。

本卡只负责 `Settings -> MicroApps` 下的独立调试页、页面内状态和 settings route 挂载，不做 backend。

为接通 T103 已确认的 `refresh=true` HTTP 语义，本卡允许对 `desktop/src/shared/api/imageGeneration.ts` 做一处窄范围跨卡修正：只补 image generation 调试页实际需要的查询参数透传与对应测试，不扩展到其他 shared API 设计。

本卡采用当前确认的工作台原型心智：

- 一个独立的 `Image Generation Studio`
- 双栏调试工作区
- `Prompt 模式 / Workflow 模式` 双模式切换
- 结果预览、任务状态、请求摘要、执行日志和调试说明

本卡不处理“从现有 `MicroApps` 列表页或详情页如何跳入该调试页”的入口衔接按钮，那部分如果需要单独开卡。

## Allowed Changes

- `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/**`
- `desktop/src/shared/api/imageGeneration.ts`
- `desktop/src/shared/api/imageGeneration.test.ts`
- `desktop/src/app/routes/settingsRoutes.tsx`
- `desktop/src/app/routes/settingsRoutes.test.tsx`
- `desktop/src/features/Settings/i18n/en-US.ts`
- `desktop/src/features/Settings/i18n/zh-CN.ts`
- `docs/project-control/tasks/microapp_T105-image-generation-desktop-debug-workspace.md`

## Forbidden Changes

- `desktop/src/shared/api/**`，但上面明确列出的 `imageGeneration.ts` 与 `imageGeneration.test.ts` 这一次跨卡修正除外
- `desktop/src/features/Settings/pages/MicroApps/index.tsx`
- `desktop/src/features/Settings/pages/MicroApps/Detail.tsx`
- `server/**`
- `electron/**`
- `tauri/**`

## Code Placement

- 调试页、局部 hook、局部组件统一放到 `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/`
- route 挂载只放到 `desktop/src/app/routes/settingsRoutes.tsx`
- 文案只放到 `desktop/src/features/Settings/i18n/*.ts`

推荐目录：

```text
desktop/src/features/Settings/pages/MicroApps/ImageGeneration/
  index.tsx
  components/
    HeaderBanner.tsx
    ModeProviderCard.tsx
    PromptRequestCard.tsx
    WorkflowRequestCard.tsx
    SubmitActionCard.tsx
    ResultPreviewCard.tsx
    TaskStatusCard.tsx
    RequestSummaryCard.tsx
    DebugLogCard.tsx
    HelpCard.tsx
  hooks/
    useImageGenerationStudioState.ts
  model/
    view-model.ts
  __tests__/
    index.test.tsx
    studio-state.test.tsx
```

约束：

- 页面局部状态只能放在本目录下的 `hooks/` 或 `model/`
- 不允许把本页调试状态塞回全局 provider、`shared/` 或现有 `MicroApps/index.tsx`

## Route Strategy

本卡实现一个独立调试路由，不复用当前 `MicroApps/Detail.tsx` 作为容器。

建议挂载方式：

- 父路由仍然在 `settings -> micro-apps`
- 新增子路由：
  - `image-generation-studio`

推荐完整路径：

- `/settings/micro-apps/image-generation-studio`

理由：

- 符合当前微应用入口树
- 不挤进现有企业集成型 `Detail.tsx`
- 不要求当前线程同时改列表页或详情页

## Prototype Baseline

前端实现以当前确认的原型为基线，必须保留下面这些页面意图：

1. 顶部标题区
   - 页面标题 `Image Generation Studio`
   - 副标题
   - “当前仅支持微应用界面内调试”的提示条
2. 左栏请求配置区
   - 模式与 provider 卡
   - `Prompt 请求` 卡
   - `Workflow 请求` 卡
   - 提交动作卡
3. 右栏反馈区
   - 结果预览卡
   - 任务状态卡
   - 请求摘要卡
   - 执行日志卡
   - 调试说明卡

## Page States

页面必须显式支持下面这些状态，而不是只渲染“有图 / 没图”：

### 页面级状态

- `initial-loading`
- `ready`
- `submitting`
- `polling`
- `terminal-success`
- `terminal-failed`

### 表单级状态

- `clean`
- `dirty`
- `invalid`
- `locked-by-running-job`

### 结果级状态

- `empty`
- `preview-loading`
- `preview-ready`
- `preview-failed`

### 任务状态轴

- `queued`
- `running`
- `succeeded`
- `failed`
- `cancelled`
- `blocked`

## Required Interaction Rules

### 模式切换

- 用户可在 `Prompt 模式` 和 `Workflow 模式` 之间切换
- `Workflow 模式` 下 provider 必须自动收敛到 `ComfyUI Local`，或只显示该选项
- 切回 `Prompt 模式` 时，workflow 区退出主视图

### Prompt 模式

必须包含：

- `Prompt`
- `Negative Prompt`
- `Size`
- `Style Preset`
- `Count=1` 的只读展示
- `高级参数` 折叠区
  - `Seed`
  - provider-specific 参数输入

### Workflow 模式

必须包含：

- `Workflow JSON` 大文本编辑区
- `上传 JSON 文件`
- `运行时覆盖 prompt`
- `运行时覆盖 seed`
- JSON 状态提示
  - `尚未输入`
  - `格式合法`
  - `不是合法 JSON`
  - `不是 ComfyUI API format`

### 提交动作

必须包含：

- `开始生成`
- `重置输入`
- 运行中条件下的 `取消任务`
- `表单已变更，尚未重新提交` 提示

### 结果反馈

必须包含：

- 空态
- 生成中态
- 成功态
- 失败态

成功态至少显示：

- 主预览区
- 尺寸
- 产物来源
- 生成时间

失败态至少显示：

- 失败标题
- 失败摘要
- 查看详细诊断入口

### 调试信息

必须有结构化调试区，不允许只有 toast：

- 请求摘要
- provider / model / mode
- provider job id
- artifact id
- 执行日志或阶段事件

## Visual Constraints

页面实现必须尽量贴近当前确认原型的气质，但继续服从项目现有 UI 规范。

要求：

- 工作台气质
- 低噪音
- 结构化
- 轻量卡片分层
- 不做大面积娱乐化 AI 装饰

约束：

- 优先使用现有 `desktop/src/shared/ui` 组件和 token
- 不新增一整套自定义设计系统
- 可以有局部页面级样式，但不能绕开全局语义 token 另起一套常驻主题

## Non-Goals

本卡明确不做：

- 从现有 `MicroApps/index.tsx` 加入口按钮
- 从现有 `MicroApps/Detail.tsx` 加调试 tab
- chat 内唤起生图
- 第三方平台入口复用
- 通用 MCP / Tool 暴露面
- 历史图库管理
- 多任务并发面板
- 作品集或社区式展示

## Acceptance Criteria

1. 新页面只服务微应用界面调试，不顺手接 chat、第三方平台入口或通用工具面板。
2. 页面内所有 backend 调用都通过 `desktop/src/shared/api/imageGeneration.ts`，不直接请求 URL。
3. 页面不直接访问 Node API、`window.desktopApi` 或 preload 细节。
4. route 变更只落在 `settingsRoutes.tsx` 和对应测试，不修改现有 `MicroApps/index.tsx`、`Detail.tsx`。
5. 页面结构必须完整实现：
   - 顶部标题区
   - 左栏四张操作卡
   - 右栏至少三张反馈卡
6. `Prompt 模式` 和 `Workflow 模式` 的切换行为符合原型说明。
7. 页面显式覆盖空态、生成中、成功、失败、JSON 非法和 blocked 场景。
8. 有定向页面测试覆盖：
   - 路由挂载
   - 模式切换
   - Prompt / Workflow 两种表单分支
   - 关键状态切换占位
9. 不修改 forbidden area。上面明列的 image generation shared API 跨卡修正不算违规扩 scope。

## Verification

- `pnpm --filter @ui-chat-mira/desktop exec vitest run src/app/routes/settingsRoutes.test.tsx src/features/Settings/pages/MicroApps/ImageGeneration/**/*.test.tsx`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证 route 挂载和页面基础行为
- `pnpm --filter @ui-chat-mira/desktop exec vitest run src/shared/api/imageGeneration.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 验证跨卡修正后的 refresh 查询参数透传
- `rg -n "fetch\\(|axios\\(|/microapps/image-generation|/api/" desktop/src/features/Settings/pages/MicroApps/ImageGeneration`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查页面没有绕过 shared API 直接请求后端
- `rg -n "window\\.desktopApi|from \\\"node:|from \\\"electron\\\"" desktop/src/features/Settings/pages/MicroApps/ImageGeneration`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查页面没有越界触碰 native 能力
- `git diff --name-only`
  - workdir: `D:/workspace/rag-demo`
  - purpose: 检查改动只落在本卡允许范围

## Evidence

- Changed files:
  - `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/**`
  - `desktop/src/shared/api/imageGeneration.ts`
  - `desktop/src/shared/api/imageGeneration.test.ts`
  - `desktop/src/app/routes/settingsRoutes.tsx`
  - `desktop/src/app/routes/settingsRoutes.test.tsx`
  - `desktop/src/features/Settings/i18n/en-US.ts`
  - `desktop/src/features/Settings/i18n/zh-CN.ts`

- Acceptance evidence:
  - `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/hooks/useImageGenerationStudioState.ts` 已改为通过 `createImageGeneration` 与 `getImageGeneration` 驱动真实提交与轮询，不再用本地 `setTimeout` 伪造 provider job、artifact、预览图或终态。
  - `desktop/src/shared/api/imageGeneration.ts` 与 `desktop/src/shared/api/imageGeneration.test.ts` 已补上 `refresh` 查询参数透传，这是为了让 T105 调试页真正接上 T103 既有的 `GET /microapps/image-generation/generations/:id?refresh=true` 语义而做的跨卡修正。
  - `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/index.tsx` 新增可替换 `api` 接缝，页面内 backend 调用统一经由 `desktop/src/shared/api/imageGeneration.ts`，未直接拼 URL、未直接碰 `window.desktopApi`。
  - `desktop/src/app/routes/settingsRoutes.tsx` 以独立完整路径 `micro-apps/image-generation-studio` 挂载调试页，没有改 `MicroApps/index.tsx` 或 `Detail.tsx`。
  - `desktop/src/app/routes/settingsRoutes.test.tsx` 不只校验路由字符串存在，还通过 `createMemoryRouter` 验证 `/settings/micro-apps/image-generation-studio` 能真实挂载页面。
  - `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/__tests__/index.test.tsx` 已覆盖模式切换、非法 ComfyUI API format、运行中锁定渲染证据、blocked 页面失败态，以及本地回收产物的成功态预览渲染。
  - `desktop/src/features/Settings/pages/MicroApps/ImageGeneration/__tests__/studio-state.test.tsx` 覆盖 workflow 模式下 provider 自动收敛到 `ComfyUI Local`、轮询时携带 `refresh: true`，以及本地 `localPath` 预览地址生成。
  - 当前 backend HTTP surface 尚未暴露 cancel endpoint，所以页面运行中保留“取消任务”按钮但禁用，并明确提示当前不可用；没有再伪造本地取消流程。

## Suggested Manual Check

实现线程完成后，至少手工确认：

1. 进入 `/settings/micro-apps/image-generation-studio` 时页面能稳定渲染。
2. `Prompt 模式` 默认打开，`Workflow 模式` 可切换。
3. `Workflow 模式` 下 `ComfyUI Local` 约束可见。
4. 成功态和失败态不会把右栏挤塌。
5. 运行中态下主按钮、取消按钮和状态提示逻辑正确。

## Isolation Rules

- 本卡是唯一允许修改 `desktop/src/app/routes/settingsRoutes.tsx` 的 image generation 线程。
- 本卡对 `desktop/src/shared/api/imageGeneration.ts` 的修改是一次明确记录的跨卡修正，只允许补 T103 刷新语义所需的最小查询参数透传和测试，不在这里继续扩 shared API 设计。
- 本卡禁止触碰现有 `MicroApps/index.tsx` 和 `Detail.tsx`，避免和当前微应用设置页维护线程互相影响。
- 如果后续一定要做“从现有微应用入口跳入本页”的衔接按钮，必须另开任务卡，不能在本卡里顺手扩 scope。
