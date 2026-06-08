# 共享 UI 组件说明

> 本目录组件遵循 `OpenAI 风格 UI 设计指南（Tailwind 版）`。
>
> 关键词：低噪音、柔和中性色、绿色强调、清晰层级、深浅主题一致。

---

## 目录

- `Button`
- `Card`
- `FullPageStatus`
- `IconButton`
- `Input`
- `Message`
- `Modal`
- `NavItem`
- `StatusIndicator`
- `Table`
- `Tooltip`

---

## 设计约束

- 默认优先使用语义 token，例如 `bg-surface-primary`、`text-text-secondary`
- 不直接在共享组件里使用 `text-gray-*`、`bg-blue-*` 作为主视觉
- 所有交互组件都应支持 `focus-visible`
- 所有组件都应兼容深色模式

---

## Button

### 用途

用于主行动、次级行动、轻量操作和危险操作。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `children` | `React.ReactNode` | - | 按钮内容 |
| `variant` | `"primary" \| "secondary" \| "outline" \| "ghost" \| "danger"` | `"secondary"` | 视觉变体 |
| `size` | `"sm" \| "md" \| "lg" \| "small" \| "medium" \| "large"` | `"md"` | 尺寸，兼容旧写法 |
| `className` | `string` | `""` | 额外样式 |
| `disabled` | `boolean` | `false` | 禁用态 |
| 其余 | `ButtonHTMLAttributes<HTMLButtonElement>` | - | 原生按钮属性 |

### 规范

- `primary`：页面唯一主行动优先使用
- `secondary`：默认按钮样式
- `ghost`：工具栏、行内轻量动作
- `danger`：删除、清空、重置等不可逆操作

---

## IconButton

### 用途

适用于工具栏、小型操作、带 Tooltip 的图标触发器。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `children` | `React.ReactNode` | - | 图标内容 |
| `ariaLabel` | `string` | - | 无障碍标签，推荐必传 |
| 其余 | `ButtonHTMLAttributes<HTMLButtonElement>` | - | 原生按钮属性 |

### 规范

- 默认中性外观
- hover 使用淡表面底色
- 必须保留键盘焦点态

---

## Card

### 用途

展示简洁信息块、统计信息或配置摘要。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `label` | `React.ReactNode` | - | 标题或标签 |
| `value` | `React.ReactNode` | - | 主内容 |
| `description` | `React.ReactNode` | - | 辅助说明 |
| `children` | `React.ReactNode` | - | 自定义内容 |
| `interactive` | `boolean` | `false` | 是否启用 hover 抬升 |
| `className` | `string` | `""` | 额外样式 |

### 规范

- 默认轻边框、轻阴影
- 内容优先，避免过重装饰
- 只有可点击卡片才使用明显 hover

---

## Input

### 组件

- `NumberInput`
- `TextInput`
- `TextArea`
- `SelectInput`

### 通用行为

- 默认使用语义 token
- 支持 `disabled`、`error`
- 支持 `compact`，用于设置页、弹窗表单、密集型配置面板
- 自动关联 `label` 与 `aria-describedby`
- 聚焦时使用统一绿色焦点环

### 规范

- 输入底色优先 `surface-primary`
- 文本优先 `text-text-primary`
- placeholder 使用 `text-text-tertiary`

---

## FullPageStatus

### 用途

用于登录校验、数据加载、空态前的页面级状态提示。

### 规范

- 居中展示
- 风格应安静，不抢页面主任务

---

## Message

### 用途

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

### Provider

```tsx
import { MessageProvider } from "@/shared/ui/Message";

<MessageProvider>
  <App />
</MessageProvider>
```

### 规范

- 文案简短
- 类型通过图标与语义色辅助区分
- 不用来承载复杂错误详情

---

## Modal

### 用途

用于承载需要专注完成的局部任务流，例如确认操作、编辑表单、预览内容。

### 全局挂载

`ModalProvider` 已在应用入口挂载，可直接使用命令式 API。

### API

```tsx
import { Modal } from "@/shared/ui/Modal";
import { Button } from "@/shared/ui/Button";

const modalKey = Modal.show({
  title: "编辑模型",
  width: 640,
  content: (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">这里可以放任意 JSX。</p>
    </div>
  ),
  footer: (
    <>
      <Button variant="ghost" onClick={() => Modal.close(modalKey)}>
        取消
      </Button>
      <Button onClick={() => Modal.close(modalKey)}>保存</Button>
    </>
  ),
});
```

### Props / Options

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `title` | `ReactNode` | - | 弹窗标题 |
| `content` | `ReactNode` | - | 主体内容，可传任意 JSX |
| `footer` | `ReactNode \| null` | 默认关闭按钮 | 底部区域；传 `null` 可隐藏 |
| `width` | `number \| string` | `560px` | 最大宽度 |
| `height` | `number \| string` | `min(720px, calc(100vh - 2rem))` | 固定高度；仅 body 区滚动 |
| `closable` | `boolean` | `true` | 是否允许关闭 |
| `maskClosable` | `boolean` | `true` | 点击遮罩是否关闭 |
| `showCloseButton` | `boolean` | `true` | 是否显示右上角关闭按钮 |
| `onClose` | `() => void` | - | 关闭回调 |

### 命令式方法

```tsx
Modal.show(options);
Modal.close(key);
Modal.close(); // 关闭最上层弹窗
Modal.destroy(); // 关闭全部弹窗
```

### 声明式外壳

如需自行管理状态，也可以使用 `ModalShell`：

```tsx
import { ModalShell } from "@/shared/ui/Modal";

<ModalShell open title="预览" onClose={handleClose}>
  <YourContent />
</ModalShell>
```

### 规范

- 内容区允许自定义 JSX，但视觉层级应继续遵循共享 token
- 默认采用固定高度容器，header / footer 固定，只有 body 区域滚动
- 默认用于短任务流，不建议承载特别长的整页内容
- 若弹窗内有主行动，建议只保留一个 `primary` 按钮

---

## NavItem

### 用途

侧边栏与局部导航。

### 规范

- 当前项使用淡强调底色而非重色块
- 非激活态仅在 hover/focus 时抬升存在感

---

## StatusIndicator

### 用途

表示运行状态、异常状态、检测中等轻量状态。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `status` | `"running" \| "stopped" \| "unknown"` | - | 状态 |
| `size` | `"sm" \| "md"` | `"md"` | 指示点尺寸 |

---

## Table

### 用途

轻量数据表格。

### 规范

- 依赖边框与留白建立结构
- 表头弱化，正文优先
- 行 hover 仅做轻提示

---

## Tooltip

### 用途

短促说明，不承载复杂内容。

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `children` | `React.ReactNode` | - | 触发元素 |
| `text` | `string` | - | 提示文案 |
| `placement` | `"top" \| "bottom" \| "left" \| "right"` | `"right"` | 位置 |

### 规范

- 同时支持 hover 与 focus-within
- 深色底、浅色字
- 文案应短，不换行优先

---

## 使用建议

- 新组件优先复用这里的 Button / Input / Tooltip 基础风格
- 新页面先套 token，再考虑局部视觉特例
- 如需修改共享视觉规则，同时更新：
  - `desktop/src/shared/ui/ui-design-guidelines-tailwind.md`
  - `desktop/src/shared/ui/COMPONENTS.md`
