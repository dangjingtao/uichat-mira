# UI 设计指南（Tailwind 版）

> 适用范围：`desktop/src/shared/ui` 以及所有依赖这套 UI token 的前端页面。

## 1. 目标

- 低噪音：减少无意义装饰，让内容本身更突出
- 高可读：优先建立清晰的信息层级
- 轻交互：hover / focus / disabled 反馈自然克制
- 主题一致：浅色与深色模式都通过同名语义 token 切换
- 主题可替换：页面风格跟随主题预设切换，不依赖写死的具体色值

## 2. 色彩体系总览

当前 UI 不是单一固定配色，而是三层结构：

1. 主题预设：定义每套主题的品牌主色、冷暖倾向和阅读氛围
2. 语义 token：把颜色映射为 `primary`、`surface-*`、`text-*`、`border` 等稳定语义
3. Tailwind token：通过 `tailwind.config.cjs` 暴露为 `bg-surface-primary`、`text-text-secondary`、`border-border` 等类名

这意味着：

- 组件和页面应该依赖语义 token，而不是依赖某个主题下的具体 HEX
- 切换主题预设时，视觉风格可以变化，但组件层级关系和交互语义不应变化
- 深色模式与浅色模式共用同一套类名，只切换 CSS 变量值

## 3. 主题预设

当前内置 4 套主题预设，定义于 [colorThemes.ts](/D:/workspace/rag-demo/desktop/src/shared/theme/colorThemes.ts)：

- `warm-neutral`：暖陶米色。默认主题，纸张感最强，适合长时间阅读、配置和复盘
- `knowledge-blue`：铁墨紫灰。低饱和紫灰与纸感中性面结合，适合知识检索、引用展示和长时间阅读
- `archive-green`：档案松绿。偏文档、索引、整理感，适合知识资产管理和档案场景
- `slate-ocean`：海石灰蓝。更理性克制，适合工作台、配置面板和企业内部工具

选择建议：

- 默认体验、登录页、通用配置页优先兼容 `warm-neutral`
- 与检索、答案可信度、结构化结果相关的页面，要确保在 `knowledge-blue` 下也成立
- 文档管理、知识库、归档感较强的页面，允许适度利用 `archive-green` 的氛围，但仍应以语义 token 驱动
- 数据面板、控制台、运维或设置型界面，优先确保在 `slate-ocean` 下保持清晰和稳定

## 4. Token 分类

### 4.1 品牌主色

- `primary`
- `primary-hover`
- `primary-1` 到 `primary-9`

用途：

- 关键按钮
- 焦点态
- 选中态
- 当前步骤 / 当前 tab / 激活指示
- 轻量品牌强调

规则：

- `primary` 只用于关键动作、焦点态、选中态，不用于铺满大面积背景
- 需要层次时优先使用 `primary-1` 到 `primary-9`
- 常见搭配是 `bg-primary/10 + text-primary`、`border-primary/20 + bg-primary/5`
- 避免在同一组件里同时混用 `primary` 和自定义蓝色 / 绿色方案

### 4.2 中性扩展色阶

- `cloudy-1` 到 `cloudy-9`
- `pampas-1` 到 `pampas-9`
- `secondary`

用途：

- `cloudy-*`：更适合边框、分隔、弱标签、灰阶文字承托
- `pampas-*`：更适合柔和背景、大面积浅底、欢迎区、空态和温和分区
- `secondary`：保留为辅助强调色，不替代 `text-secondary`

规则：

- `pampas` 和 `cloudy` 都是扩展风格色，不是正文与结构的第一入口
- 它们可以参与氛围塑造，但不能取代 `surface-*`、`text-*`、`border`
- 当页面已经足够复杂时，优先减少 `pampas-*` 装饰层，回到 `surface-*`

### 4.3 结构语义色

- `surface-primary`
- `surface-secondary`
- `surface-tertiary`
- `surface-elevated`
- `border`

用途：

- `surface-primary`：页面主卡片、输入容器、主体内容底
- `surface-secondary`：次一级分区、hover 弱反馈、列表背景切换
- `surface-tertiary`：更强一点的区分层，适合禁用轨道、弱分层容器
- `surface-elevated`：浮层、下拉、Tooltip、Modal 内容承托
- `border`：通用描边和结构分隔

规则：

- 页面结构先用 `surface-*` 建层，再决定是否需要 `pampas-*` / `primary-*` 氛围增强
- 浮层默认优先 `surface-elevated`
- 输入区优先 `surface-primary`
- 不要依赖阴影单独建立层级，背景和边框应先成立

### 4.4 文本与图标语义色

- `text-primary`
- `text-secondary`
- `text-tertiary`
- `text-inverted`
- `icon-primary`
- `icon-secondary`
- `icon-tertiary`
- `icon-inverted`

用途：

- `text-primary`：标题、正文、关键数据
- `text-secondary`：说明、元信息、非主路径辅助信息
- `text-tertiary`：placeholder、弱提示、禁用信息
- `text-inverted`：深色按钮或深底容器上的文字
- `icon-*`：与对应文字层级保持一致，不要长期用正文色替代全部图标

规则：

- 正文和标题优先使用 `text-*`，不要回退到 `cloudy-*`
- 图标颜色优先用 `icon-*`，让图标层级独立于文案层级
- 强调不是只靠颜色完成，必要时配合字号、字重和留白

### 4.5 状态语义色

- `success`
- `warning`
- `danger`
- `info`
- `success-soft` / `warning-soft` / `danger-soft` / `info-soft`
- `success-border` / `warning-border` / `danger-border` / `info-border`
- `success-text` / `warning-text` / `danger-text` / `info-text`

用途：

- 表单校验
- 状态 badge
- Toast / Message
- 风险提示和结果反馈

规则：

- 状态色只用于语义反馈，不做页面主色
- 优先使用成组状态 token，而不是临时手写透明度
- 状态块建议优先 `*-soft + *-border + *-text`
- 当状态文案较长时，仍以 `surface-* + border-*` 建结构，状态色只做提醒

## 5. 推荐映射

常见场景建议优先使用以下搭配：

| 场景 | 推荐 token |
| --- | --- |
| 页面主背景 / 主容器 | `bg-surface-primary` |
| 次级容器 / hover | `bg-surface-secondary` |
| 浮层 / 下拉 / Tooltip | `bg-surface-elevated border-border` |
| 主标题 / 正文 | `text-text-primary` |
| 说明文案 / 元信息 | `text-text-secondary` |
| placeholder / 弱提示 | `text-text-tertiary` |
| 普通边框 | `border-border` |
| 主按钮 | `bg-primary text-white hover:bg-primary-hover` |
| 选中项 / 轻强调 | `bg-primary/10 text-primary` |
| 危险提示 | `border-danger-border bg-danger-soft text-danger-text` |
| 成功状态 | `border-success-border bg-success-soft text-success-text` |
| 警告提示 | `border-warning-border bg-warning-soft text-warning-text` |
| 信息提示 | `border-info-border bg-info-soft text-info-text` |

## 6. Dos / Don'ts

### Do

- 优先写 `bg-surface-primary`，而不是手写 `bg-white`
- 优先写 `text-text-secondary`，而不是用某个灰阶猜层级
- 需要柔和欢迎感时，优先小面积使用 `pampas-*`
- 需要品牌层级时，优先从 `primary-1` 到 `primary-9` 找合适级别
- 先保证浅色和深色都成立，再决定是否加额外装饰色

### Don't

- 不要在共享组件里直接依赖 `gray-*`、`slate-*`、`blue-*` 作为主体系
- 不要把 `primary` 铺成整页背景
- 不要让 `pampas-*` 承担正文对比度
- 不要用状态色替代导航激活色或主操作色
- 不要因为某个页面“看起来更好看”就绕开现有语义 token

## 7. 组件色彩约束

- Button：`primary` 负责主操作，`secondary` / `outline` 回到 `surface-* + border`
- Input / Select：默认 `bg-surface-primary border-border text-text-primary`，focus 使用 `primary`
- Modal / Tooltip / Dropdown：优先 `surface-elevated + border`
- Table：用 `surface-*`、`border`、`text-*` 建结构，不做厚重报表蓝灰底
- StatusBadge / StatusIndicator：状态色仅在点、边、浅底中使用，避免整块高饱和填充
- Thread / Chat：优先安静的中性面和轻主色强调，避免聊天区出现大片状态色面板

## 8. 视觉约束

- 卡片优先轻边框、轻阴影
- 表格优先用边框和留白建立结构，不做厚重报表风格
- 当表格列宽总和超出容器时，优先保留列宽并提供横向滚动，不要把关键内容压缩到不可读
- Tooltip、Toast、Modal 都保持克制，不抢主任务视觉
- Detail Drawer 应保持右侧上下文感，避免做成全屏打断式交互
- ErrorBoundary 等异常兜底界面应优先使用柔和背景、轻量卡片和明确恢复动作，避免制造额外紧张感
- Tooltip 允许长文本换行，并应限制最大宽度，避免路径或错误详情溢出视口
- 尽量避免大面积高饱和色块

## 9. 交互约束

- 可交互元素必须有 `focus-visible`
- 动效优先 `150ms ~ 200ms`
- 优先动画属性：`opacity`、`transform`、`background-color`、`border-color`
- 图标按钮必须有 `aria-label`
- `focus-visible` 优先使用 `ring-primary/20` 与 `ring-offset-surface-primary`

## 10. 表单与配置页

- 输入区优先 `surface-primary`
- 配置页允许更紧凑密度，但不要牺牲可读性
- 工作台类页面允许左右分栏，但左右两侧都应控制信息密度，避免噪音堆积
- 布尔开关优先使用共享 `Switch`
- 行内二级操作优先使用共享 `IconButton`
- 共享选择器优先使用基于 Radix 原语封装的 `shared/ui/Select`，不要在业务组件内重复手写 listbox

## 11. 知识库页补充约定

- 文件类型图标优先复用共享 `FileIcon`
- 轻状态展示优先复用 `StatusIndicator`
- 多步骤流程优先复用 `StepIndicator`
- 上传流程中的文件条目优先复用 `FileListItem`

## 12. Chat / Thread

- Keep the chat surface quiet and spacious; avoid heavy card stacking
- Prefer a light assistant container for long answers and a higher-contrast user bubble
- Show assistant runtime states inside the active assistant bubble when useful, especially distinguishing "waiting for first token" from "already streaming text"
- Execution traces and RAG progress blocks should prefer single-line summaries, compact rows, and neutral surfaces over stacked cards or warm warning-like panels
- When a thread exposes step-level JSON details, prefer a right-side in-layout drawer that narrows the reading column instead of a full-screen modal overlay
- If the composer is docked, keep the fade and background transition smooth against the page
- Do not overload the thread with extra controls before message readability and input focus are solid
- Favor a centered reading column with soft neutral bubbles, subtle avatars, and a frosted composer shell
- Empty-state onboarding cards can be slightly warmer than the main chat surface, using cream backgrounds and beige borders as long as the page still reads as calm and low-noise

## 13. 组件变更要求

当新增或修改共享组件，或调整主题 token / 颜色语义时，必须同步更新：

- `desktop/src/shared/ui/COMPONENTS.md`
- `desktop/src/shared/ui/ui-design-guidelines-tailwind.md`
- 若变更影响主题结构或预设含义，同时更新 [colorThemes.ts](/D:/workspace/rag-demo/desktop/src/shared/theme/colorThemes.ts) 附近注释或相关设置文案
