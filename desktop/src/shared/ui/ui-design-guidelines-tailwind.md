# OpenAI 风格 UI 设计指南（Tailwind 版）

> 适用范围：`desktop/src/shared/ui` 以及依赖其设计 token 的前端页面。
>
> 目标：让界面更接近 OpenAI / ChatGPT 产品常见的视觉语言——克制、清晰、温和、以内容和对话为中心，而不是传统后台的高饱和控制台风格。

---

## 1. 设计目标

### 1.1 气质关键词

- **Quiet**：低噪音，减少无意义装饰与强对比边框。
- **Readable**：强调文字可读性与信息层级，弱化“UI 炫技”。
- **Conversational**：组件像对话界面的一部分，而不是“管理系统控件堆砌”。
- **Trustworthy**：状态明确、反馈及时、层级稳定。

### 1.2 不采用的风格

- 不使用大面积高饱和蓝色作为默认主色。
- 不使用过重阴影、过多描边、强烈拟物按钮。
- 不依赖复杂渐变、玻璃拟态或营销页式视觉特效。

---

## 2. OpenAI 风格抽象

基于 OpenAI 官方品牌与开发者产品可观察到的共性，这套规范遵循以下原则：

- **品牌层面**：以中性黑白灰为主基调，绿色作为少量关键强调色。
- **产品层面**：优先使用柔和表面色、圆润但不过度的圆角、短促自然的动效。
- **交互层面**：聚焦输入、消息、状态反馈和轻量操作，避免视觉焦点过多。
- **主题层面**：所有语义 token 必须天然支持浅色 / 深色，而不是在组件里手工硬编码两套颜色。

---

## 3. 设计 Token

### 3.1 颜色原则

#### 主色

- `primary` 是 **强调色**，只用于：
  - 主按钮
  - 焦点态
  - 链接 / 高优先级行动
  - 选中态的轻量底色
- 常规导航、表格、面板不应大面积使用 `primary` 实底。

#### 中性色

- 界面主体依靠 `surface-*` 与 `text-*` 建立层级。
- 深浅模式切换应通过 **同名语义 token 自动映射** 完成。

### 3.2 语义颜色

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `primary` | `#10A37F` | `#19C59F` | 主行动、焦点、选中强调 |
| `primary-hover` | `#0E8C6D` | `#14A37F` | 主行动悬停 |
| `secondary` | `#64748B` | `#94A3B8` | 次级说明、低优先级 UI |
| `success` | `#16A34A` | `#4ADE80` | 成功态 |
| `warning` | `#D97706` | `#F59E0B` | 警告态 |
| `danger` | `#DC2626` | `#F87171` | 错误 / 危险操作 |
| `info` | `#2563EB` | `#60A5FA` | 信息提示 |

### 3.3 Surface 与文字

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `surface-primary` | `#FFFFFF` | `#171717` | 主要面板、卡片、输入框主体 |
| `surface-secondary` | `#F7F7F5` | `#1F1F1F` | 页面底色、轻量区块 |
| `surface-tertiary` | `#ECECE8` | `#2A2A2A` | hover、分段容器、弱强调底 |
| `surface-elevated` | `#FFFFFF` | `#1C1C1E` | 弹层、Toast、浮层 |
| `border` | `#E5E7EB` | `#3F3F46` | 细分隔与边框 |
| `text-primary` | `#18181B` | `#F5F5F5` | 主文本 |
| `text-secondary` | `#52525B` | `#A1A1AA` | 次文本 |
| `text-tertiary` | `#71717A` | `#71717A` | placeholder、提示文字 |
| `text-inverted` | `#FAFAFA` | `#18181B` | 反色文本 |
| `icon-primary` | `#18181B` | `#F5F5F5` | 主图标 |
| `icon-secondary` | `#71717A` | `#A1A1AA` | 次图标 |

### 3.4 字体

OpenAI 官方品牌字体不可直接内置到本项目时，采用以下替代栈，保留接近的几何无衬线气质：

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### 3.5 字体层级

| Token | 大小 | 字重 | 行高 | 用途 |
|---|---|---|---|---|
| `display` | 28px | 600 | 1.2 | 页面主标题 |
| `heading-1` | 20px | 600 | 1.3 | 区块标题 |
| `heading-2` | 16px | 600 | 1.4 | 卡片标题、表头 |
| `body` | 14px | 400 | 1.6 | 正文 |
| `body-small` | 13px | 400 | 1.5 | 辅助说明 |
| `caption` | 12px | 500 | 1.4 | 标签、提示、状态 |

### 3.6 间距

坚持 4px 基线，但优先使用 **12 / 16 / 20 / 24** 这类更符合内容型产品的节奏。

| Token | 值 | 典型场景 |
|---|---|---|
| `space-1` | 4px | 图标与文本最小间距 |
| `space-2` | 8px | 微小控件间距 |
| `space-3` | 12px | 表单项、局部区块 |
| `space-4` | 16px | 卡片内边距、列表项 |
| `space-5` | 20px | 中型区块 |
| `space-6` | 24px | 模态框、页面段落 |
| `space-8` | 32px | 页面级分组 |

### 3.7 圆角

OpenAI 风格偏柔和，但不会过度圆润。

| Token | 值 | 用途 |
|---|---|---|
| `radius-sm` | 8px | badge、紧凑控件 |
| `radius-md` | 10px | 输入框、按钮 |
| `radius-lg` | 14px | 卡片、列表容器 |
| `radius-xl` | 18px | 浮层、模态框 |
| `radius-pill` | 9999px | 胶囊状态、圆形按钮 |

### 3.8 阴影

阴影应轻，主要用于“层级提示”，不是“材质表达”。

| Token | 值 | 用途 |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(15,23,42,0.05), 0 1px 1px rgba(15,23,42,0.03)` | 默认卡片 / 输入 |
| `shadow-md` | `0 8px 24px rgba(15,23,42,0.08)` | 浮起卡片 |
| `shadow-lg` | `0 16px 40px rgba(15,23,42,0.14)` | Tooltip / Toast / Dropdown |
| `shadow-xl` | `0 24px 60px rgba(15,23,42,0.18)` | Modal |

---

## 4. 组件规范

### 4.1 Button

#### 设计原则

- 主按钮只保留一个高优先级动作。
- 次级按钮优先使用中性底色，不抢视觉焦点。
- 文本和图标按钮需尽量轻量。

#### Variant

| Variant | 规范 |
|---|---|
| `primary` | 绿色实底，白字，轻阴影 |
| `secondary` | 中性表面底，细边框，主文本色 |
| `outline` | 透明底 + 中性边框，hover 出现淡表面底 |
| `ghost` | 无边框无底，hover 才出现背景 |
| `danger` | 红色实底，仅用于不可逆操作 |

#### Size

| Size | 高度 | 说明 |
|---|---|---|
| `sm` | 32px | 紧凑工具操作 |
| `md` | 40px | 默认 |
| `lg` | 44px | 高优先级或移动端 |

### 4.2 Input / TextArea / Select

- 默认使用 `surface-primary`，而不是明显发灰的输入底色。
- 聚焦时通过 **边框 + ring** 给反馈，不使用刺眼外发光。
- 错误态优先通过边框和说明文本提示，不只依赖颜色。
- 当页面属于“设置面板 / 配置中心 / Modal 表单”时，允许提供 `compact` 密度版本，优先压缩高度与纵向留白，而不是把字体缩到难读。

### 4.3 Card

- 卡片默认轻边框 + 轻阴影。
- 内容优先，标题和描述层级应明显。
- 只有可点击卡片才应出现更明显 hover 抬升。

### 4.4 Tooltip

- Tooltip 应像“短促说明”，不是弹窗。
- 默认深色底 / 浅色字。
- 支持 hover 与 keyboard focus。

### 4.5 Toast

- Toast 应浮于内容之上，但不打断任务流。
- 使用 `surface-elevated`、模糊背景和圆润圆角。
- 文案尽量短；复杂错误应落回页面内状态。

### 4.6 Modal

- Modal 用于需要暂时打断当前流程、要求用户聚焦完成的小型任务。
- 容器使用 `surface-elevated`、柔和大圆角和轻模糊遮罩。
- 默认宽度保持克制，优先 `480px` ~ `640px`。
- 对配置型 Modal，优先固定高度；仅内容 body 可滚动，header 和 footer 不进入滚动区域。
- 主体区域允许放入任意 JSX，但内部仍应使用共享 token 和共享组件。
- 底部操作区建议“次级在左，主按钮在右”，且主行动不超过一个。

### 4.7 Table

- 用分隔线建立结构，不依赖重色 zebra stripe。
- 表头弱化为辅助信息层，不要像后台报表一样过重。

### 4.8 Navigation

- 当前项以轻量底色或淡强调色表达即可。
- 避免“整块高饱和选中背景”。

---

## 5. 交互规范

### 5.1 动效

- 时长优先 `150ms` ~ `200ms`
- 常用 easing：`ease-out`
- 只动画 `opacity`、`transform`、`background-color`、`border-color`

### 5.2 焦点

- 所有可交互元素必须有一致的焦点环：
  - `focus-visible:ring-2`
  - `focus-visible:ring-primary/20`
  - `focus-visible:ring-offset-2`

### 5.3 可访问性

- 图标按钮必须有 `aria-label`
- 错误提示通过 `aria-describedby` 关联
- Toast 容器必须有 `aria-live`
- Tooltip 除 hover 外，也要支持 focus 触发

---

## 6. Tailwind Token 实现要求

### 6.1 强制要求

- token 必须使用 **语义名称**，不能把业务组件直接绑定到十六进制颜色。
- Tailwind 颜色必须基于 CSS 变量，确保同一类名在深浅主题下自动切换。
- 组件内部禁止继续硬编码 `gray-xxx` / `blue-xxx` 作为主视觉方案。

### 6.2 推荐模式

```ts
colors: {
  primary: "rgb(var(--color-primary) / <alpha-value>)",
  border: "rgb(var(--color-border) / <alpha-value>)",
  text: {
    primary: "rgb(var(--color-text-primary) / <alpha-value>)",
  },
}
```

---

## 7. 组件开发 checklist

- 是否优先使用中性色建立层级？
- 是否只在关键动作上使用 `primary`？
- 是否在浅色和深色模式都可读？
- 是否避免了不必要的高饱和蓝色？
- 是否存在清晰的 hover / focus / disabled / error 状态？
- 是否保留向后兼容的 props 能力？

---

## 8. 参考依据

- OpenAI Brand：字体气质、留白、克制的中性色和强调色使用方式
- OpenAI Developers / Apps 相关文档：组件可嵌入、主题适配、边界轻量化与可访问性交互要求

> 这份规范不是照搬官网单页视觉，而是把 OpenAI 官方产品常见的品牌气质和交互习惯，抽象成适合当前 Electron + React + Tailwind 项目的可执行设计系统。
