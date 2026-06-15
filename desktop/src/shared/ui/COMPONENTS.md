# 共享 UI 组件说明

> 目录：`desktop/src/shared/ui`
>  
> 所有组件默认遵循语义化 token、浅/深色兼容、轻量交互反馈和可访问性优先的原则。

## 目录

- `Button`
- `Card`
- `Detail Drawer`
- `ErrorBoundary`
- `FileIcon`
- `FileListItem`
- `FileUploadDropzone`
- `FullPageStatus`
- `IconButton`
- `Input`
- `Message`
- `Modal`
- `NavItem`
- `Select`
- `StatusIndicator`
- `StepIndicator`
- `Switch`
- `Table`
- `Tooltip`

## 设计约束

- 优先使用语义 token，例如 `bg-surface-primary`、`text-text-secondary`
- 共享组件内不直接依赖 `gray-*`、`blue-*` 作为主视觉方案
- 需要主色层级时，优先使用 `primary-1` 到 `primary-9` 这一组主题色阶
- 可交互组件必须保留 `focus-visible` 态
- 所有组件都应天然兼容浅色 / 深色主题

## Button

用于主操作、次操作和危险操作。

### Props

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `children` | `React.ReactNode` | - | 按钮内容 |
| `variant` | `"primary" \| "secondary" \| "outline" \| "ghost" \| "danger"` | `"secondary"` | 视觉变体 |
| `size` | `"sm" \| "md" \| "lg" \| "small" \| "medium" \| "large"` | `"md"` | 尺寸，兼容旧写法 |
| `disabled` | `boolean` | `false` | 禁用态 |

## IconButton

用于工具栏、行内操作和图标触发器。

### 约束

- 必须提供 `ariaLabel`
- 默认保持轻量，不承担主操作角色

## ErrorBoundary

用于捕获渲染树中的未处理异常，并提供简洁的恢复界面。

### 当前行为

- 渲染错误时展示全页级兜底界面
- 提供 `重试` 与 `刷新应用` 两个恢复操作
- 保留错误详情折叠区，方便本地排查
- 视觉上遵循低噪音卡片式反馈，不抢主任务焦点

## Card

用于信息分组、摘要展示和轻量配置面板。

### 使用建议

- 信息卡片优先使用 `label + value + description`
- 复杂区域优先使用 `children`
- 仅在确实可点击时增加明显 hover

## Detail Drawer

用于从页面右侧滑出展示详情，适合表格行详情、运行记录复盘和保持当前列表上下文的查看场景。

### 使用建议

- 优先用于只读详情，不承担主流程的长表单编辑
- 抽屉内容应按“摘要 -> 配置 -> 明细 -> 日志”分区组织
- 保持关闭动作明确，避免在抽屉内堆叠过多主操作

## FileIcon

根据文件扩展名展示统一图标。

### 当前映射

- `PDF` → 红色文档图标
- `XLS/XLSX` → 绿色表格图标
- 其他类型 → 蓝色通用文档图标

## FileListItem

用于上传流程中的文件条目展示。

### 内容

- 文件图标
- 文件名
- 扩展名 / 大小
- 删除操作

### 扩展能力

- `active`：用于高亮当前选中的文件
- `onClick`：用于切换预览目标或进入文件详情

## FileUploadDropzone

用于上传区，支持点击选择与拖拽。

### Props

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `onSelectFiles` | `(files: FileList \| null) => void` | 文件选中回调 |
| `helperText` | `React.ReactNode` | 辅助说明 |
| `accept` | `string` | 接收文件类型 |
| `maxCount` | `number` | 最大文件数 |

## StepIndicator

用于多步骤页面顶部的流程指示。

### Props

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `currentStep` | `number` | 当前步骤 |
| `steps` | `{ step: number; label: string }[]` | 步骤列表 |

## StatusIndicator

用于展示轻量状态点。

### 支持状态

- `running`
- `stopped`
- `unknown`

## Switch

用于布尔开关。

### Props

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `checked` | `boolean` | - | 当前开关状态 |
| `onChange` | `() => void` | - | 点击回调 |
| `disabled` | `boolean` | `false` | 禁用态 |
| `ariaLabel` | `string` | - | 无障碍标签，推荐传入 |

### 使用建议

- 用于启停、布尔配置、列表行内状态切换
- 不承担带文案的主操作，通常与 Tooltip 或标签搭配

## Table

轻量表格容器，适合简单数据行展示。

### 设计约束

- 用边框和留白建立结构
- 表头弱化，不做厚重报表风格
- 行 hover 仅做轻提示

## Tooltip

用于短文本提示，不承载复杂内容。

### 当前实现

- 基于 `react-tooltip` 做统一封装
- 保持 `text` 与 `placement` 的轻量 API
- 默认限制最大宽度，并允许长文本换行
- 适合图标按钮、截断文案和状态补充说明

## FullPageStatus

用于整页级轻状态，例如空态、加载说明或权限提示。

## Input

用于表单输入，包括文本、数字、多行文本与选择器。

### 通用 Props

- `labelHelp`：可选说明文本，会在 label 旁以 Tooltip 问号图标展示；用于避免业务页手写重复 label 和说明图标

### Select

- 保持 `label`、`value`、`onChange`、`options`、`disabled`、`error`、`compact` 轻量 API
- 下拉面板使用共享 surface / border / primary token，当前项以主色弱底和勾选图标标识
- 下拉面板挂在触发器所在的相对容器中，随页面滚动一起移动，不使用固定定位 portal
- 在弹窗、抽屉等滚动容器内，会优先根据最近滚动容器的可用空间自动决定向上或向下展开，并动态限制面板高度，避免遮挡 footer
- 支持点击外部、`Esc` 与 `Tab` 关闭，并保留触发器的 `focus-visible` 状态

## Message

全局 Toast 提示。

### API

```tsx
import { message } from "@/shared/ui/Message";

message.success("保存成功");
message.error("保存失败，请重试");
message.warning("请检查输入内容");
message.info("已复制到剪贴板");
message.loading("提交中...");
message.destroy();
```

## Modal

用于需要用户聚焦处理的局部任务流。

### 设计约束

- 默认用于短任务，不承载过长整页内容
- Header / Footer 固定，Body 滚动
- 主操作不超过一个

## 更新说明

当修改或新增共享组件时，请同时更新：

- `desktop/src/shared/ui/COMPONENTS.md`
- `desktop/src/shared/ui/ui-design-guidelines-tailwind.md`

## Tooltip

用于承载补充说明、路径、状态原因等次级信息。

### 设计约束

- 默认用于短说明，不替代主文案
- 长文本允许换行，避免超出视口
- 优先作为图标、截断文案或状态点的补充说明
- 不在 Tooltip 中承载主操作

## Modal

用于承载确认、设置和说明类弹窗。
### Props

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| width | 
umber \| string | 弹窗宽度，支持像素或 CSS 尺寸值 |
| height | 
umber \| string | 显式固定高度；不传时按内容自适应 |
| maxHeight | 
umber \| string | 最大高度，默认限制在视口内 |

## Chat-specific UI

`Thread` 和 `RagProgressDetailDrawer` 已迁移到 `desktop/src/features/chat/components/Thread`。

这两类组件依赖当前线程状态、RAG 观测数据和 assistant-ui 运行时，不再视为共享 UI 组件。
