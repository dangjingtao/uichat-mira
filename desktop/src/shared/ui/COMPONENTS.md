# 共享 UI 组件说明

> 目录：`desktop/src/shared/ui`
>  
> 所有组件默认遵循语义化 token、浅/深色兼容、轻量交互反馈和可访问性优先的原则。

## 目录

- `Button`
- `Card`
- `FileIcon`
- `FileListItem`
- `FileUploadDropzone`
- `FullPageStatus`
- `IconButton`
- `Input`
- `Message`
- `Modal`
- `NavItem`
- `StatusIndicator`
- `StepIndicator`
- `Switch`
- `Table`
- `Thread`
- `Tooltip`

## 设计约束

- 优先使用语义 token，例如 `bg-surface-primary`、`text-text-secondary`
- 共享组件内不直接依赖 `gray-*`、`blue-*` 作为主视觉方案
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

## Card

用于信息分组、摘要展示和轻量配置面板。

### 使用建议

- 信息卡片优先使用 `label + value + description`
- 复杂区域优先使用 `children`
- 仅在确实可点击时增加明显 hover

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

## FullPageStatus

用于整页级轻状态，例如空态、加载说明或权限提示。

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

## Thread

Used for the main chat thread, composed from `assistant-ui` primitives in a calmer, OpenAI-inspired style.
### Current behavior

- `assistant` messages use a light card surface for long-form reading
- `user` messages stay right-aligned with a higher-contrast bubble
- the composer stays docked at the bottom to preserve reading continuity
- colors and elevation should rely on `surface-*`, `text-*`, and `border` tokens

### Usage notes

- Prefer it for primary chat pages and single-thread AI conversation views
- When extending attachments, tool calls, or retry actions, keep changes inside the current primitive structure for backward compatibility
