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
- `Markdown / Long-form Content`
- `Modal`
- `NavItem`
- `Select`
- `StatusIndicator`
- `StepIndicator`
- `Switch`
- `Table`
- `Tooltip`

## 设计约束

- 优先使用语义 token，例如 `bg-surface-primary`、`text-text-secondary`、`border-border`
- 共享组件内不直接依赖 `gray-*`、`slate-*`、`blue-*` 作为主视觉方案
- 需要主色层级时，优先使用 `primary-1` 到 `primary-9`
- `pampas-*` 与 `cloudy-*` 属于扩展氛围色阶，不替代 `surface-*`、`text-*`、`border`
- 可交互组件必须保留 `focus-visible`
- 所有组件都应天然兼容浅色 / 深色主题与主题预设切换
- 组件默认服务于“低噪音、高可读、可回看”的 AI 工作流，不做炫技型视觉

## 色彩体系速记

当前共享组件依赖的主要 token 分类如下：

| 分类 | 典型 token | 主要用途 |
| --- | --- | --- |
| 品牌主色 | `primary`、`primary-hover`、`primary-1~9` | 主操作、焦点、选中、轻强调 |
| 结构层级 | `surface-primary`、`surface-secondary`、`surface-elevated`、`border` | 页面、卡片、浮层、描边 |
| 文本图标 | `text-*`、`icon-*` | 文本与图标层级 |
| 扩展氛围 | `pampas-*`、`cloudy-*` | 柔和承托、边框灰阶、欢迎区 |
| 状态反馈 | `success`、`warning`、`danger`、`info` 及其 `*-soft` / `*-border` / `*-text` | 校验、结果、风险反馈 |

共享组件默认配色规则：

- 主体容器优先 `surface-*`
- 正文与标题优先 `text-*`
- 边框统一优先 `border`
- 焦点和选中优先 `primary`
- 状态色只做结果反馈，不做主结构色
- 状态容器优先使用 `*-soft + *-border + *-text`，纯 `success/warning/danger/info` 主要留给点、图标和强调值

共享组件默认排版规则：

- 正文优先清楚和稳定，不追求纤细或花哨字形
- 长文本、说明、日志、JSON、代码各自使用稳定字体角色
- 当组件内同时出现标题、正文、辅助说明时，优先靠字号、字重、留白建层，不靠颜色堆层

## Button

用于主操作、次操作和危险操作。

### Props

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `children` | `React.ReactNode` | - | 按钮内容 |
| `variant` | `"primary" \| "secondary" \| "outline" \| "ghost" \| "danger"` | `"secondary"` | 视觉变体 |
| `size` | `"sm" \| "md" \| "lg" \| "small" \| "medium" \| "large"` | `"md"` | 尺寸，兼容旧写法 |
| `disabled` | `boolean` | `false` | 禁用态 |

### 色彩约束

- `primary`：`bg-primary text-white hover:bg-primary-hover`
- `secondary`：`bg-surface-primary border-border text-text-primary`
- `outline`：透明底，仅保留 `border + text`
- `ghost`：适合轻次级操作，默认 `text-text-secondary`
- `danger`：仅用于危险确认和不可逆操作

## IconButton

用于工具栏、行内操作和图标触发器。

### 约束

- 必须提供 `ariaLabel`
- 默认保持轻量，不承担主操作角色
- 默认使用 `text-text-secondary`，hover 再提升到 `text-text-primary`

## ErrorBoundary

用于捕获渲染树中的未处理异常，并提供简洁的恢复界面。

### 当前行为

- 渲染错误时展示全页级兜底界面
- 提供 `重试` 与 `刷新应用` 两个恢复操作
- 保留错误详情折叠区，方便本地排查
- 视觉上遵循低噪音卡片式反馈，不抢主任务焦点

### 色彩建议

- 结构仍以 `surface-*`、`border` 为主
- 错误相关强调可用 `danger/5`、`danger/20`、`text-danger`
- 不使用大面积纯红底

## Card

用于信息分组、摘要展示和轻量配置面板。

### 使用建议

- 信息卡片优先使用 `label + value + description`
- 复杂区域优先使用 `children`
- 仅在确实可点击时增加明显 hover
- 优先使用 `bg-surface-primary border-border shadow-shadow-sm`

## Detail Drawer

用于从页面右侧滑出展示详情，适合表格行详情、运行记录复盘和保持当前列表上下文的查看场景。

### 使用建议

- 优先用于只读详情，不承担主流程的长表单编辑
- 抽屉内容应按“摘要 -> 配置 -> 明细 -> 日志”分区组织
- 保持关闭动作明确，避免在抽屉内堆叠过多主操作
- 抽屉主体优先 `bg-surface-primary`，避免过强颜色干扰主列表

## FileIcon

根据文件扩展名展示统一图标。

### 当前映射

- `PDF` -> 红色文档图标
- `XLS/XLSX` -> 绿色表格图标
- 其他类型 -> 蓝色通用文档图标

### 备注

- 文件图标允许保留类型识别色，但不要把这种文件色扩散为页面主视觉体系

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

### 色彩建议

- 选中态优先 `primary` 弱底或 `surface-secondary`
- 删除操作仅按钮或图标使用危险语义，不把整行染成危险色

## FileUploadDropzone

用于上传区，支持点击选择与拖拽。

### Props

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `onSelectFiles` | `(files: FileList \| null) => void` | 文件选中回调 |
| `helperText` | `React.ReactNode` | 辅助说明 |
| `accept` | `string` | 接收文件类型 |
| `maxCount` | `number` | 最大文件数 |

### 交互与色彩

- 默认以 `surface-secondary` 作为承托，hover 可回到 `surface-primary`
- 拖拽激活可用 `primary/10` 或更清晰的 `border-primary/30`
- disabled 时降低对比度，不显示可点击暗示

## FullPageStatus

用于整页级轻状态，例如空态、加载说明或权限提示。

### 色彩建议

- 默认使用中性面
- 警告和错误状态优先通过图标、标题和按钮表达，不用整页高饱和色

## Input

用于表单输入，包括文本、数字、多行文本与选择器。

### 通用 Props

- `labelHelp`：可选说明文本，会在 label 旁以 Tooltip 问号图标展示；用于避免业务页手写重复 label 和说明图标

### 色彩约束

- 默认 `bg-surface-primary border-border text-text-primary`
- placeholder 使用 `text-text-tertiary`
- focus 使用 `border-primary + ring-primary/20`
- disabled 回退到 `surface-secondary` 和 `text-text-tertiary`
- error 文案与错误描边使用 `danger`

## Select

共享选择器，基于 Radix Select 原语封装。

### 当前能力

- 保持 `label`、`value`、`onChange`、`options`、`disabled`、`error`、`compact` 轻量 API
- 统一接管键盘导航、焦点管理、类型搜索与无障碍语义
- 下拉面板通过 portal 渲染到顶层，避免在弹窗、抽屉和滚动容器中被裁切
- 下拉浮层默认使用更高层级，避免被弹窗、抽屉和聊天悬浮区遮挡
- 为兼容业务层空字符串值，组件内部会对 option value 做编码映射；外部仍保持原始字符串 API

### 色彩约束

- Trigger：`bg-surface-primary border-border text-text-primary`
- Placeholder：`text-text-tertiary`
- Focus：`focus:border-primary focus:ring-primary/20`
- Content：`bg-surface-elevated border-border`
- Content radius：默认控制在 `10px` 左右，避免过圆的业务浮层
- Item highlighted：`bg-primary/10`
- Item checked：`bg-primary/10 text-primary`

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

### 色彩建议

- 成功 / 警告 / 错误 / 信息都以语义色为核心
- 避免让 toast 背景过重，优先保持可读和轻量
- loading 和异常提示优先转成用户可理解文案，不直接暴露底层 key 或技术性英文
- 需要浅底状态块时，优先：
  - 成功：`bg-success-soft border-success-border text-success-text`
  - 警告：`bg-warning-soft border-warning-border text-warning-text`
  - 错误：`bg-danger-soft border-danger-border text-danger-text`
  - 信息：`bg-info-soft border-info-border text-info-text`

### 内容建议

- toast 文案优先一句话说清结果
- 不把日志、堆栈、原始错误 key 直接塞进全局提示
- AI 中间过程提示默认弱化，避免反复打断阅读

## Markdown / Long-form Content

用于聊天长回复、知识说明、评测结果摘要、工具调用结果说明等文档型内容。

### 设计目标

- 读起来像结构清楚的文档，而不是一大块聊天气泡
- 标题、段落、列表、引用、代码块、表格层级必须稳定
- 长文本优先提升阅读连续性，而不是增加容器装饰

### 约束

- 正文优先 `15px ~ 16px` 与较舒展行高
- 标题不宜过重，避免压迫
- 引用、来源、备注使用弱边框和轻底，不做醒目警告色
- 代码块、日志、JSON 与正文明确区分，但仍保持安静基调
- 复杂结果优先“摘要 -> 正文 -> 来源/附件 -> 过程细节”的顺序

## Composer Pattern

用于线程底部输入区及其附件、工具、发送、停止等动作。

### 约束

- Composer 是 AI 工作流主舞台，优先保证输入焦点和阅读延续
- 默认不做过薄输入框
- 发送按钮清楚但克制，不做强营销感
- 运行中的停止按钮与发送按钮尺寸应接近，避免布局跳变
- 附件、知识库、工具入口都属于二级动作，应弱于输入内容本身
- 底部悬浮外壳可以有轻模糊和渐变承托，但不能抢消息区视觉

## Execution Trace / AI Runtime Block

用于展示计划、执行轨迹、RAG 过程、工具调用、运行中状态和细节展开。

### 约束

- 默认优先紧凑行和单行摘要，不优先厚重卡片
- 中间态以中性面、轻边框、清楚文案表达，不滥用警告色
- 详情默认折叠或抽屉展开，避免把主阅读区压碎
- 结果、错误、可重试动作要分清，但不制造额外焦虑
- 裸 JSON 只在确有调试价值时显示，并应放在二级层

## Modal

用于承载确认、设置和说明类弹窗。

### Props

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `width` | `number \| string` | 弹窗宽度，支持像素或 CSS 尺寸值 |
| `height` | `number \| string` | 显式固定高度；不传时按内容自适应 |
| `maxHeight` | `number \| string` | 最大高度，默认限制在视口内 |

### 设计约束

- 默认用于短任务，不承载过长整页内容
- Header / Footer 固定，Body 滚动
- 主操作不超过一个
- 默认优先内容自适应，仅在复杂表单或长内容场景下再显式传入 `height / maxHeight`

### 色彩建议

- 主体内容优先 `surface-primary`
- 遮罩和弹层都应克制，避免强黑压迫感

## NavItem

用于侧边导航、次级列表导航和轻量菜单项。

### 色彩建议

- 非激活态优先 `text-text-secondary`
- hover 使用 `surface-secondary` 或 `pampas-*` 弱底
- 激活态可以使用主色指示条或 `primary` 弱底，不建议整块高饱和主色填充

## StatusIndicator

用于展示轻量状态点。

### 支持状态

- `running`
- `stopped`
- `unknown`

### 色彩约束

- 点色可分别使用 `success`、`danger`、`warning`
- 周围 ring 优先使用对应 `*-border`
- 弱底状态块优先使用对应 `*-soft`

## StepIndicator

用于多步骤页面顶部的流程指示。

### Props

| 属性 | 类型 | 说明 |
| --- | --- | --- |
| `currentStep` | `number` | 当前步骤 |
| `steps` | `{ step: number; label: string }[]` | 步骤列表 |

### 色彩建议

- 当前步骤优先 `primary`
- 已完成步骤可使用 `primary/10 + text-primary`
- 未到达步骤使用 `surface-secondary` 或 `text-tertiary`

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
- 打开态使用 `primary`，关闭态回到 `surface-tertiary`

## Table

轻量表格容器，适合简单数据行展示。

### 设计约束

- 用边框和留白建立结构
- 表头弱化，不做厚重报表风格
- 行 hover 仅做轻提示
- 当列总宽度超过容器时，允许整表横向滚动，不强行压缩列内容

### 色彩建议

- 表格主体优先 `bg-surface-primary`
- 行 hover 优先 `bg-surface-secondary/80`
- Sticky 列继续使用 `surface-*`，不要额外换一套灰色体系

## Tooltip

用于承载补充说明、路径、状态原因等次级信息。

### 当前实现

- 基于 `react-tooltip` 做统一封装
- 保持 `text` 与 `placement` 的轻量 API
- 默认限制最大宽度，并允许长文本换行
- 适合图标按钮、截断文案和状态补充说明

### 设计约束

- 默认用于短说明，不替代主文案
- 长文本允许换行，避免超出视口
- 优先作为图标、截断文案或状态点的补充说明
- 不在 Tooltip 中承载主操作
- 浮层优先 `surface-elevated + border-border`

## Chat-specific UI

`Thread` 和 `RagProgressDetailDrawer` 已迁移到 `desktop/src/features/chat/components/Thread`。

这两类组件依赖当前线程状态、RAG 观测数据和 assistant-ui 运行时，不再视为共享 UI 组件。

## 更新说明

当修改或新增共享组件时，请同时更新：

- `desktop/src/shared/ui/COMPONENTS.md`
- `desktop/src/shared/ui/ui-design-guidelines-tailwind.md`
