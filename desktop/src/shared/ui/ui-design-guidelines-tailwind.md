# OpenAI 风格 UI 设计指南（Tailwind 版）

> 适用范围：`desktop/src/shared/ui` 以及所有依赖这套 UI token 的前端页面。

## 1. 目标

- 低噪音：减少无意义装饰，让内容本身更突出
- 高可读：优先建立清晰的信息层级
- 轻交互：hover / focus / disabled 反馈自然克制
- 主题一致：浅色与深色模式都通过同名语义 token 切换

## 2. 颜色原则

- `primary` 只用于关键动作、焦点态、选中态
- 当组件需要主色阶层次时，优先使用 `primary-1` 到 `primary-9`，避免直接混用独立蓝色或灰色方案
- `pampas` 适合大面积浅底、柔和分区和空态承托；`cloudy` 适合边框、弱化标签和中性辅助层，不要让两者取代正文对比度
- 页面主体依赖 `surface-*`、`text-*`、`border`
- 成功 / 警告 / 危险色仅用于语义反馈，不做页面主色

## 3. 视觉约束

- 卡片优先轻边框、轻阴影
- 表格优先用边框和留白建立结构，不做厚重报表风格
- Tooltip、Toast、Modal 都保持克制，不抢主任务视觉
- Detail Drawer 应保持右侧上下文感，避免做成全屏打断式交互
- ErrorBoundary 等异常兜底界面应优先使用柔和背景、轻量卡片和明确恢复动作，避免制造额外紧张感
- Tooltip 允许长文本换行，并应限制最大宽度，避免路径或错误详情溢出视口
- 尽量避免大面积高饱和色块

## 4. 交互约束

- 可交互元素必须有 `focus-visible`
- 动效优先 `150ms ~ 200ms`
- 优先动画属性：`opacity`、`transform`、`background-color`、`border-color`
- 图标按钮必须有 `aria-label`

## 5. 表单与配置页

- 输入区优先 `surface-primary`
- 配置页允许更紧凑密度，但不要牺牲可读性
- 工作台类页面允许左右分栏，但左右两侧都应控制信息密度，避免噪音堆积
- 布尔开关优先使用共享 `Switch`
- 行内二级操作优先使用共享 `IconButton`
- 选择器下拉面板应跟随触发器所在页面区域滚动，避免使用脱离页面滚动上下文的固定定位
- 共享选择器优先使用 `shared/ui/Select`，避免把下拉实现继续内嵌在业务表单组件里

## 6. 知识库页补充约定

- 文件类型图标优先复用共享 `FileIcon`
- 轻状态展示优先复用 `StatusIndicator`
- 多步骤流程优先复用 `StepIndicator`
- 上传流程中的文件条目优先复用 `FileListItem`

## 7. 组件变更要求

当新增或修改共享组件时，必须同步更新：

- `desktop/src/shared/ui/COMPONENTS.md`
- `desktop/src/shared/ui/ui-design-guidelines-tailwind.md`

- FileUploadDropzone 在前置业务条件未满足时应支持 disabled 状态，禁用点击并给出明确说明。

- Modal 默认应优先内容自适应，仅在复杂表单或长内容场景下再显式传入 height / maxHeight。

## 8. Chat / Thread

- Keep the chat surface quiet and spacious; avoid heavy card stacking
- Prefer a light assistant container for long answers and a higher-contrast user bubble
- Show assistant runtime states inside the active assistant bubble when useful, especially distinguishing "waiting for first token" from "already streaming text"
- Execution traces and RAG progress blocks should prefer single-line summaries, compact rows, and neutral surfaces over stacked cards or warm warning-like panels
- When a thread exposes step-level JSON details, prefer a right-side in-layout drawer that narrows the reading column instead of a full-screen modal overlay
- If the composer is docked, keep the fade and background transition smooth against the page
- Do not overload the thread with extra controls before message readability and input focus are solid
- Favor a centered reading column with soft neutral bubbles, subtle avatars, and a frosted composer shell
- Empty-state onboarding cards can be slightly warmer than the main chat surface, using cream backgrounds and beige borders as long as the page still reads as calm and low-noise
