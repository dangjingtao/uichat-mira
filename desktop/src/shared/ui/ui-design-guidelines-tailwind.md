# UI 设计指南（Tailwind 版）

> 适用范围：`desktop/src/shared/ui` 以及所有依赖这套 UI token 的前端页面。

## 1. 目标

- 低噪音：减少无意义装饰，让内容本身更突出
- 高可读：优先建立清晰的信息层级
- 轻交互：hover / focus / disabled 反馈自然克制
- 主题一致：浅色与深色模式都通过同名语义 token 切换
- 主题可替换：页面风格跟随主题预设切换，不依赖写死的具体色值
- AI 原生：界面应服务于思考、执行和交付，不制造额外复杂性

## 2. 产品气质

> 重要约束：
>
> - 默认设计必须保持紧凑，慎用大圆角、厚阴影和大面积卡片堆叠
> - 业务页不要直接写 `rounded-2xl`、`rounded-3xl` 作为默认方案
> - 圆角优先使用统一 token：`rounded-ui-control`、`rounded-ui-panel`、`rounded-ui-overlay`、`rounded-ui-hero`

整体气质保持：

- 冷静、可信、清晰、亲和
- 有智能感，但不炫技
- 内容优先，而不是装饰优先
- 复杂性交给模型和系统，界面负责把复杂过程解释清楚

不追求以下方向：

- 赛博朋克或强娱乐化 AI 视觉
- 满屏渐变、发光、粒子、霓虹边框
- 依赖机器人、魔法棒、星光等符号强行表达“智能”
- 用夸张视觉掩盖结构和交互不清楚的问题

## 3. 色彩体系总览

当前 UI 不是单一固定配色，而是三层结构：

1. 主题预设：定义每套主题的品牌主色、冷暖倾向和阅读氛围
2. 语义 token：把颜色映射为 `primary`、`surface-*`、`text-*`、`border` 等稳定语义
3. Tailwind token：通过 `tailwind.config.cjs` 暴露为 `bg-surface-primary`、`text-text-secondary`、`border-border` 等类名

这意味着：

- 组件和页面应该依赖语义 token，而不是依赖某个主题下的具体 HEX
- 切换主题预设时，视觉风格可以变化，但组件层级关系和交互语义不应变化
- 深色模式与浅色模式共用同一套类名，只切换 CSS 变量值

## 4. 主题预设

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
- 非默认主题在浅色模式下也应保持与 `warm-neutral` 接近的 surface / border / text 层级强度，变化重点放在冷暖倾向和气质，而不是牺牲可读性或把页面做灰

## 5. Token 分类

### 5.1 品牌主色

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
- AI 产品中品牌主色应保持克制，避免让每个“智能动作”都染成主色

### 5.2 中性扩展色阶

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

### 5.3 结构语义色

- `surface-primary`
- `surface-auth`
- `surface-secondary`
- `surface-tertiary`
- `surface-elevated`
- `border`

用途：

- `surface-primary`：页面主卡片、输入容器、主体内容底
- `surface-auth`：登录页、欢迎区、纸感更强的品牌入口背景
- `surface-secondary`：次一级分区、hover 弱反馈、列表背景切换
- `surface-tertiary`：更强一点的区分层，适合禁用轨道、弱分层容器
- `surface-elevated`：浮层、下拉、Tooltip、Modal 内容承托
- `border`：通用描边和结构分隔

规则：

- 页面结构先用 `surface-*` 建层，再决定是否需要 `pampas-*` / `primary-*` 氛围增强
- 浮层默认优先 `surface-elevated`
- 输入区优先 `surface-primary`
- 不要依赖阴影单独建立层级，背景和边框应先成立

### 5.4 文本与图标语义色

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

### 5.5 状态语义色

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
- AI 中间过程状态默认优先中性面或轻强调，不要滥用 `warning` / `danger`

## 6. 色彩比例

页面默认遵守 `80 / 15 / 5` 思路：

- `80%` 中性色：背景、卡片、正文、分隔、输入容器
- `15%` 柔和辅助层：浅底分组、空态、欢迎区、轻分层承托
- `5%` 品牌与关键强调：主按钮、焦点、选中、当前步骤、关键 AI 动作

补充规则：

- 主按钮通常只使用一类主色，不与危险色混用
- 删除、清空、不可逆操作只使用危险语义色
- 工具调用、执行中、计划中、等待中等 AI 中间态，优先使用中性面、轻描边和文字层级表达
- 长文本阅读区避免使用刺眼纯白，优先温和浅底

## 7. 推荐映射

常见场景建议优先使用以下搭配：

| 场景 | 推荐 token |
| --- | --- |
| 页面主背景 / 主容器 | `bg-surface-primary` |
| 登录页 / 欢迎区主底 | `bg-surface-auth` |
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

## 7.1 圆角尺度

圆角不要再靠页面临场发挥，优先使用统一 token：

| 场景 | 推荐 token | 说明 |
| --- | --- | --- |
| 交互控件 | `rounded-ui-control` | 按钮、输入框、图标按钮、轻量标签 |
| 内容面板 | `rounded-ui-panel` | 卡片、表格容器、空态块、提示块 |
| 浮层 | `rounded-ui-overlay` | Modal、下拉、Toast、确认层 |
| 英雄 / 欢迎区 | `rounded-ui-hero` | 登录页、首页大横幅、强视觉封面 |
| 圆形元素 | `rounded-full` | 头像、状态点、徽标、少量胶囊 |

补充规则：

- 控件默认不要超过 `ui-control`，否则会显得松散
- 页面中最常见的容器应停在 `ui-panel`
- `ui-overlay` 只留给浮层，不要拿来做普通卡片
- `ui-hero` 只在明确需要更强视觉存在感时使用
- 不要在业务页继续写 `rounded-2xl`、`rounded-3xl` 作为默认

## 8. Typography

### 8.1 字体角色

- UI 主字体：优先 `font-sans`
- 代码、日志、ID、路径：优先 `font-mono`
- 不额外引入“未来感”或装饰性字体破坏可读性

当前项目默认字体栈已覆盖 Windows 中文与等宽场景，应继续沿用统一入口，不在业务页私自切换字体。

### 8.2 字号层级

推荐使用以下层级，不要在业务页随意漂移：

- 页面大标题：`28px ~ 36px`，`600`
- 区块标题：`18px ~ 22px`，`600`
- 正文：`15px ~ 16px`，`400`
- 辅助说明：`13px ~ 14px`，`400`
- 按钮文本：`14px ~ 15px`，`500 ~ 600`
- 代码 / 日志：`12px ~ 14px`，`400`

### 8.3 推荐 token 映射

优先复用现有 typography token，不在业务页临时发明一套字号：

| 语义 | 推荐 token / 类名 | 尺寸 | 字重 | 行高 | 典型场景 |
| --- | --- | --- | --- | --- | --- |
| Display | `text-display` | `28px` | `600` | `1.2` | 欢迎区主标题、登录页主标题 |
| Heading 1 | `text-heading-1` | `20px` | `600` | `1.3` | 页面区块标题、卡片主标题 |
| Heading 2 | `text-heading-2` | `16px` | `600` | `1.4` | 次级标题、表单分组标题 |
| Body | `text-body` | `14px` | `400` | `1.6` | 普通正文、说明主体 |
| Body Small | `text-body-small` | `13px` | `400` | `1.5` | 辅助说明、元信息 |
| Caption | `text-caption` | `12px` | `500` | `1.4` | 标签、状态、弱提示 |

补充约束：

- 聊天长文、知识说明、评测摘要等需要更强可读性时，可在 `text-body` 基础上提升到 `15px ~ 16px`
- 指标卡、表格、状态行优先从 `Heading 2 / Body / Caption` 三档中选，不额外插入大量中间字号
- 代码、日志、JSON 默认搭配 `font-mono`，再按 `12px ~ 14px` 选择

### 8.4 行高与中文排版

- 中文正文建议 `line-height: 1.6 ~ 1.8`
- 说明文案建议 `1.5 ~ 1.6`
- 标题不建议超过 `700`，避免压迫感
- Windows 环境避免过细字重，优先 `400 / 500 / 600`
- 大段浅灰文字必须检查对比度，不能把“克制”做成“难读”

### 8.5 数字与工程文本

- 表格、评测指标、时间、token、耗时、计数等优先使用等宽数字或 `tabular-nums`
- 日志、JSON、路径、代码片段统一使用 `font-mono`
- 不要在正文段落里混入过多不同字体角色

## 9. Dos / Don'ts

### Do

- 优先写 `bg-surface-primary`，而不是手写 `bg-white`
- 优先写 `text-text-secondary`，而不是用某个灰阶猜层级
- 需要柔和欢迎感时，优先小面积使用 `pampas-*`
- 需要品牌层级时，优先从 `primary-1` 到 `primary-9` 找合适级别
- 先保证浅色和深色都成立，再决定是否加额外装饰色
- 让留白、字号、字重和分区承担主要层级工作

### Don't

- 不要在共享组件里直接依赖 `gray-*`、`slate-*`、`blue-*` 作为主体系
- 不要把 `primary` 铺成整页背景
- 不要让 `pampas-*` 承担正文对比度
- 不要用状态色替代导航激活色或主操作色
- 不要因为某个页面“看起来更好看”就绕开现有语义 token
- 不要用更多卡片、更多图标、更多颜色去代替更清楚的结构
- 不要用“AI 风格化”图标堆叠来表达能力感

## 10. 组件色彩约束

- Button：`primary` 负责主操作，`secondary` / `outline` 回到 `surface-* + border`，危险幽灵操作优先 `danger-ghost`，`link` 只用于行内文本动作
- Badge：通用胶囊优先复用共享 `Badge`，只保留少量 `neutral / primary / success / warning / danger / muted` 变体
- CodeBlock / TerminalPanel：代码块、日志块、模拟终端优先复用共享组件，不要在业务页反复手写 `font-mono + border + bg + scroll`
- 当日志区已经嵌入 `TabCard`、详情壳或其他主容器时，优先使用 `TerminalPanel` 的轻壳/无壳变体，而不是在业务页重复手写去边框去圆角样式
- SegmentedTabs：胶囊 tab 优先复用共享 `SegmentedTabs`，不要在业务页重复拼 active / inactive 样式
- TabCard：当 tabs、辅助说明和内容区属于同一张工作台卡片时，优先复用共享 `TabCard`，不要在业务页重复手写 `tabs + header + body`
- Input / Select：默认 `bg-surface-primary border-border text-text-primary`，focus 使用 `primary`
- Modal / Tooltip / Dropdown：优先 `surface-elevated + border`
- DropdownMenu / Submenu 必须通过 portal 渲染，并显式高于底部悬浮 Composer、抽屉和普通卡片层
- 搜索选择类弹窗优先使用共享 `SearchSelectModal`，并保持“固定搜索头 + 独立滚动结果区”
- 搜索选择类弹窗默认走更紧凑的 modal 壳层，列表项应以单行标题、轻量元信息和较小圆角为主，避免大卡片堆叠
- Table：用 `surface-*`、`border`、`text-*` 建结构，不做厚重报表蓝灰底
- 紧凑业务表格优先使用共享 `Table` 的 `compact` 模式，先压缩表头和行高，再考虑删列
- 表头分隔线应由 `th` 承载，sticky 场景下更稳定
- 表体首行不要再单独补 `border-t`，统一从第二行开始建立分隔节奏
- StatusBadge / StatusIndicator：状态色仅在点、边、浅底中使用，避免整块高饱和填充
- Thread / Chat：优先安静的中性面和轻主色强调，避免聊天区出现大片状态色面板

## 11. 视觉约束

- 卡片优先轻边框、轻阴影
- 表格优先用边框和留白建立结构，不做厚重报表风格
- 当表格列宽总和超出容器时，优先保留列宽并提供横向滚动，不要把关键内容压缩到不可读
- Tooltip、Toast、Modal 都保持克制，不抢主任务视觉
- Dropdown / Select / Popover 等浮层要显式高于页面抽屉、底部输入悬浮区和普通卡片层
- 业务型 dropdown 圆角建议收敛到 `8px ~ 10px`，避免浮层边界过软
- Detail Drawer 应保持右侧上下文感，避免做成全屏打断式交互
- 抽屉壳层优先复用共享 `Drawer`，业务页不要重复手写 portal、遮罩、滑入动画和 body 滚动锁
- 图片遮罩预览和滚轮缩放优先复用共享 `ImagePreviewOverlay`，不要在业务页重复拼装黑色遮罩和缩放逻辑
- ErrorBoundary 等异常兜底界面应优先使用柔和背景、轻量卡片和明确恢复动作，避免制造额外紧张感
- Tooltip 允许长文本换行，并应限制最大宽度，避免路径或错误详情溢出视口
- 尽量避免大面积高饱和色块
- Logo、品牌字标、欢迎区视觉元素进入工作流后应主动退后，让位于内容与操作
- 二次确认组件应保持紧凑，慎用大圆角、厚阴影和厚卡片式边界，默认以清晰文本、轻图标和单一危险主操作表达风险
- 欢迎区、空态英雄图这类大视觉包装优先复用共享 `WelcomePanel`，业务组件只保留文案和资源选择

## 12. 交互约束

- 可交互元素必须有 `focus-visible`
- 动效优先 `150ms ~ 200ms`
- 优先动画属性：`opacity`、`transform`、`background-color`、`border-color`
- 图标按钮必须有 `aria-label`
- `focus-visible` 优先使用 `ring-primary/20` 与 `ring-offset-surface-primary`
- 复杂能力优先渐进披露，不要默认把全部配置摊平
- 中间过程应尽量可取消、可折叠、可回看

## 13. 表单与配置页

- 输入区优先 `surface-primary`
- 配置页允许更紧凑密度，但不要牺牲可读性
- 表单优先复用 `shared/ui` 组件，不要在业务页重复写同一套输入框、文本域、按钮或卡片类名
- 默认设计应相对紧凑，慎用大圆角、厚阴影和大面积卡片堆叠
- 普通配置面板、浅底分组、虚线空态优先复用共享 `Card` 变体，不要在页面里重复拼装 `rounded + border + bg + shadow`
- 工作台类页面允许左右分栏，但左右两侧都应控制信息密度，避免噪音堆积
- 布尔开关优先使用共享 `Switch`
- 行内二级操作优先使用共享 `IconButton`
- `IconButton` 不再在业务页手写尺寸；统一使用 `xs / sm / md / lg`，默认 `ghost + default`
- 共享选择器优先使用基于 Radix 原语封装的 `shared/ui/Select`，不要在业务组件内重复手写 listbox
- 配置型表单默认先展示“当前有效值”和最关键动作，把进阶项放到二级层
- 长文本富文本编辑优先复用共享 `MarkdownEditor`，不要在业务页直接初始化第三方编辑器实例
- 异常提示优先翻译成用户可理解文案，不直接展示底层错误 key 或技术性英语

## 14. 知识库页补充约定

- 文件类型图标优先复用共享 `FileIcon`
- 轻状态展示优先复用 `StatusIndicator`
- 多步骤流程优先复用 `StepIndicator`
- 上传流程中的文件条目优先复用 `FileListItem`
- 知识库描述等多行短文本输入优先复用共享 `TextArea`
- 二次确认优先复用 `Modal.confirm`，删除、清空、不可逆动作不要在页面里重复拼装确认框

## 15. Chat / Thread

- 聊天主界面应保持安静、开阔，避免厚重卡片层层堆叠
- 助手长回复优先使用轻容器，用户消息可保留更高对比度气泡
- 助手运行态应尽量放在当前回复上下文中展示，尤其区分“等待首 token”和“已开始流式输出”
- 执行轨迹与 RAG 过程优先使用单行摘要、紧凑行和中性表面，而不是堆叠卡片或偏警告色面板
- 当线程暴露步骤级 JSON 详情时，优先使用右侧内嵌抽屉压缩阅读列，而不是全屏 modal 打断
- 如果 Composer 为底部停靠式，渐变、毛玻璃和背景过渡都应平滑衔接页面
- 在消息可读性和输入焦点未稳定前，不要向线程区域堆叠额外控制按钮
- 优先使用居中的阅读列、柔和中性气泡、低存在感头像和轻雾化 Composer 外壳
- 空态引导卡片可以比主聊天区略暖，但整体仍应保持低噪音和克制

补充约束：

- AI 回复应优先读起来像文档，而不是一大块聊天气泡
- 长回复中的标题、段落、列表、引用、代码块、表格必须有明确层级
- 执行过程、RAG 轨迹、推理摘要、工具调用结果应更像工作记录，而不是警告面板堆叠
- “等待首 token”和“已开始流式输出”应尽量区分，不要统一成模糊 loading
- 分支、重试、编辑等多轮能力默认以轻量版本模型呈现，不把树结构直接暴露给普通用户

## 16. Composer Pattern

Composer 是 AI 产品的主舞台，默认遵守：

- 输入区默认保持较舒展高度，不做过薄单行输入
- 多行扩展必须平滑，不引发明显跳动
- 附件、知识库、工具入口应退居输入内容之后，不能抢主焦点
- 发送按钮应清楚、克制，不做营销 CTA 风格
- 运行中的停止按钮与发送按钮应保持相近尺寸级别，避免布局跳动
- docked composer 的阴影、毛玻璃、渐变都只能做轻承托，不能盖过消息正文

## 17. AI 输出模式

当模型输出较长、较复杂或带执行过程时，优先按以下模式组织：

- `Plan`：简短步骤、单行动作、低噪音列表
- `Execution Trace`：紧凑行、可折叠、可查看详情
- `Result`：正文、表格、代码、来源分区清楚
- `Verification`：状态、耗时、失败原因、重试建议清楚

避免：

- 每个阶段都做成厚重卡片
- 把所有中间态都做成醒目的 warning 面板
- 在聊天正文里直接裸露大段 JSON，除非用户明确需要

## 18. 品牌与图形使用

- 品牌字标、图形和欢迎区视觉只在登录页、空态、启动态适度强化
- 一旦进入工作流，品牌元素应退居次级
- 不直接借用第三方 AI 品牌图形、logo、专有视觉资产
- 自有 logo 与 favicon 允许保留圆角几何气质，但不能牺牲可读性
- 不使用大量“机器人头 / 魔法棒 / 星光”来替代真正的产品智能感

### 18.1 助手头像备选资源

当前已沉淀两组聊天助手头像备选资源，均按 `4` 套主题完成总览与单张裁切，可直接用于评审或二次导出：

- 正式抽象版总览：
  [sheet.png](/D:/workspace/rag-demo/docs/assets/assistant-avatars/formal/sheet.png)
- 飞行员产品化版总览：
  [sheet.png](/D:/workspace/rag-demo/docs/assets/assistant-avatars/pilot/sheet.png)

单张裁切资源目录：

- 正式抽象版：
  [formal](/D:/workspace/rag-demo/docs/assets/assistant-avatars/formal)
- 飞行员产品化版：
  [pilot](/D:/workspace/rag-demo/docs/assets/assistant-avatars/pilot)

命名规则：

- 行：`a / b / c`
- 列：`warm-neutral / knowledge-blue / archive-green / slate-ocean`
- 例如：`a-warm-neutral.png`、`b-knowledge-blue@128.png`

当前推荐：

- 聊天主头像优先使用“飞行员产品化版” `A` 行
- 如果需要更抽象、更稳妥的企业感备选，使用“正式抽象版” `A` 行
- `B / C` 行保留为增强角色感或较大尺寸场景的备选，不默认进入聊天主线

## 19. 组件变更要求

当新增或修改共享组件，或调整主题 token / 颜色语义时，必须同步更新：

- `desktop/src/shared/ui/COMPONENTS.md`
- `desktop/src/shared/ui/ui-design-guidelines-tailwind.md`
- 若变更影响主题结构或预设含义，同时更新 [colorThemes.ts](/D:/workspace/rag-demo/desktop/src/shared/theme/colorThemes.ts) 附近注释或相关设置文案
