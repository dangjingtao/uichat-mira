# OpenAI 风格 UI 设计指南（Tailwind 版）

> 适用范围：`desktop/src/shared/ui` 以及所有依赖这套 UI token 的前端页面。

## 1. 目标

- 低噪音：减少无意义装饰，让内容本身更突出
- 高可读：优先建立清晰的信息层级
- 轻交互：hover / focus / disabled 反馈自然克制
- 主题一致：浅色与深色模式都通过同名语义 token 切换

## 2. 颜色原则

- `primary` 只用于关键动作、焦点态、选中态
- 页面主体依赖 `surface-*`、`text-*`、`border`
- 成功 / 警告 / 危险色仅用于语义反馈，不做页面主色

## 3. 视觉约束

- 卡片优先轻边框、轻阴影
- 表格优先用边框和留白建立结构，不做厚重报表风格
- Tooltip、Toast、Modal 都保持克制，不抢主任务视觉
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
- 布尔开关优先使用共享 `Switch`
- 行内二级操作优先使用共享 `IconButton`

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
- If the composer is docked, keep the fade and background transition smooth against the page
- Do not overload the thread with extra controls before message readability and input focus are solid
