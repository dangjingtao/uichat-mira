# Chrome 扩展详细设计（触界）

Status: Draft  
Layer: design-doc / extension  
Scope: MVP Phase 1（最小可用）

Runtime boundary: the extension is Vanilla JS only. It performs basic page extraction and sends JSON captures to `/microapps/evolving-knowledge/captures`. It does not start a backend, run Python/Node services, crawl pages outside the browser, or persist files.

---

## 设计原则

1. **零构建依赖** — MVP 阶段纯 Vanilla JS，不引入 Vite/Webpack/React，降低维护成本。
2. **权限最小化** — 只申请 `activeTab`、`storage`、`scripting`，不碰 `history`/`tabs`/`webNavigation`。
3. **无状态转发** — 扩展本身不持久存储剪藏数据，只做采集和转发，数据归集到桌面端 SQLite。
4. **失败可感知** — 任何网络/权限/后端异常必须在 Side Panel 上明确提示，不静默吞错。

---

## 文件结构

```
extension/
├── manifest.json              # Manifest V3
├── background.js              # Service Worker（右键菜单、快捷键兜底、跨域请求）
├── popup/
│   ├── popup.html             # Chrome Side Panel 主界面
│   ├── popup.css              # 样式（单文件，无 CSS 框架）
│   └── popup.js               # Side Panel、内联授权和剪藏逻辑
├── content/
│   └── content.js             # Content Script（读取页面元数据、选中文字）
├── options/
│   ├── options.html           # 扩展选项页
│   ├── options.css
│   └── options.js
└── icons/
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```

> **为什么无构建工具？**  
> 扩展总代码量预计 < 500 行，引入构建链的收益远低于维护成本。如需 TS 或代码拆分，在 Phase 2 再评估。

---

## Manifest V3

```json
{
  "manifest_version": 3,
  "name": "触界",
  "version": "1.0.0",
  "description": "连接 Mira，操作网页并支持用户主动剪藏",
  "permissions": [
    "activeTab",
    "storage",
    "scripting",
    "sidePanel",
    "downloads"
  ],
  "host_permissions": [
    "http://localhost:*/",
    "http://127.0.0.1:*/"
  ],
  "action": {
    "default_title": "打开触界",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png"
    }
  },
  "side_panel": {
    "default_path": "popup/popup.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "commands": {
    "_execute_action": {
      "suggested_key": {
        "default": "Ctrl+Shift+S",
        "mac": "Command+Shift+S"
      },
      "description": "打开触界"
    }
  },
  "options_page": "options/options.html",
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

### 权限说明

| 权限 | 用途 | 为什么不更少/更多 |
|------|------|------------------|
| `activeTab` | 获取当前标签页的 URL、title、favicon | 比 `tabs` 更精准，只针对用户正在看的页面 |
| `storage` | 保存用户偏好（后端地址、默认标签） | `localStorage` 在 Service Worker 中不可用 |
| `scripting` | 向当前页注入 content script 读取选中文字 | MV3 中读取页面 DOM 的标准方式 |
| `sidePanel` | 在 Chrome 右侧常驻显示触界 | 让见行状态、剪藏与授权共享一个持续界面 |
| `downloads` | 触发 HTTP(S) 文件下载 | 不读取用户下载历史，只执行明确的下载请求 |
| `host_permissions` | 只允许向 localhost/127.0.0.1 发请求 | 不上传任何数据到外部服务器 |

---

## 组件设计

### 1. Content Script (`content/content.js`)

**职责**：在用户点击扩展图标时，被动态注入到当前页面，采集元数据后立即卸载（不常驻）。

**采集字段**：

```typescript
interface PageInfo {
  url: string;              // location.href
  canonicalUrl: string | null;  // <link rel="canonical"> href
  title: string;            // document.title
  selectedText: string;     // window.getSelection().toString().trim()
  favicon: string | null;   // <link rel="icon"> href 或默认 /favicon.ico
}
```

**注入方式**（在 popup.js 中调用）：

```javascript
chrome.scripting.executeScript({
  target: { tabId: currentTab.id },
  files: ['content/content.js']
});
```

> **注意**：content script 不直接发请求。它只负责读取页面信息并通过 `chrome.runtime.sendMessage` 回传，避免 CSP 和跨域问题。

---

### 2. Side Panel (`popup/popup.html` + `popup.js` + `popup.css`)

**尺寸**：跟随 Chrome 侧栏宽度响应式伸缩，最小宽度 320px，高度占满侧栏。

**布局结构**：

```
┌──────────────────────────────┐
│ 触界              [已连接]    │  ← 品牌与连接状态
├──────────────────────────────┤
│ [见行]          [剪藏]        │  ← 能力切换
├──────────────────────────────┤
│ [favicon] 页面标题（可编辑）   │  ← 剪藏元数据区
│ https://example.com          │
├──────────────────────────────┤
│ 选中文字（如果有）            │  ← 可折叠预览区
│ "这是一段用户在网页上..."     │
│                    [收起 ▲]   │
├──────────────────────────────┤
│ 标签                         │  ← 输入区
│ [AI      ][工具    ][x]      │  ← 芯片式标签，回车生成，点击 x 删除
│ 输入标签后回车...             │
├──────────────────────────────┤
│ 备注                         │
│ ┌──────────────────────────┐ │
│ │                          │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ [智能剪藏 ▼]                 │  ← 保存模式切换
│   · 智能剪藏（默认）          │
│   · 截图保存                 │   截图模式：跳过爬虫，直接发视口截图
├──────────────────────────────┤
│          [保存到 Mira]       │  ← 主按钮
│      后端未连接 · 请启动桌面端 │  ← 状态栏（错误时变红）
└──────────────────────────────┘
```

**字段说明**：

| 字段 | 来源 | 可编辑 | 校验规则 |
|------|------|--------|----------|
| 标题 | 页面 `<title>` | ✅ 是 | 非空，最长 200 字符 |
| URL | `location.href` | ❌ 否 | 只读展示 |
| 选中文字 | `window.getSelection()` | ✅ 是（可删减） | 最长 2000 字符，超出截断 |
| 标签 | 用户输入 | ✅ 是 | 单个标签最长 30 字符，最多 10 个 |
| 备注 | 用户输入 | ✅ 是 | 最长 500 字符 |
| 保存模式 | 用户选择 | ✅ 是 | 两种：`smart`（默认） / `screenshot` |

**交互细节**：

- **标签输入**：回车或逗号生成芯片；支持 Backspace 删除最后一个标签；Phase 1 不做自动补全。
- **保存按钮**：点击后禁用并显示 spinner，防止重复提交。
- **标题编辑**：默认填充页面标题，用户可手动修改（解决部分网站标题过长或无用前缀问题）。
- **选中文字**：如果用户未选中任何文字，该区域隐藏；如果有，默认展开，可点击收起。
- **保存模式切换**：
  - **智能剪藏（默认）**：只发送 URL 和元数据，后端用 Readability 爬取正文。
  - **截图保存**：扩展调用 `chrome.tabs.captureVisibleTab()` 获取当前视口 PNG，以 Base64 一并 POST 到后端；后端跳过爬虫，直接用 VLM 提取文字。适用于 paywall 页面、SPA、动态加载内容等爬取困难场景。

**数据流**：

```
Side Panel 打开或活动标签页变化
    ↓
调用 chrome.tabs.query({active:true, currentWindow:true}) 获取当前 tab
    ↓
向当前 tab 注入 content.js 并发送 "GET_PAGE_INFO" 消息
    ↓
收到 PageInfo → 填充表单
    ↓
用户编辑 → 点击 [保存到 Mira]
    ↓
POST {url, title, selectedText, tags, note, favicon} 到后端 /api/clippings
    ↓
后端返回 202 → 显示 "已保存"，侧栏保持打开
后端返回错误 → 显示具体错误信息，恢复按钮
```

---

### 3. Background Service Worker (`background.js`)

**职责**：

1. **注册右键菜单**：安装时创建 `contextMenus`。
2. **处理右键点击**：点击后打开 Side Panel 并切到“剪藏”。
3. **跨域请求兜底**：若未来需要绕过某些 CSP 限制，可在 background 中发 `fetch`（拥有更广的 host 权限）。

**右键菜单设计**：

```javascript
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.contextMenus.create({
    id: 'mira-clipper-save-page',
    title: '剪藏页面到 Mira',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // 用户手势中打开当前窗口的 Side Panel
  chrome.sidePanel.open({ windowId: tab.windowId });
});
```

右键菜单只打开侧栏，不做静默保存。用户仍需在“剪藏”分区明确确认。

---

### 4. Options 选项页 (`options/`)

**职责**：让用户配置后端地址和查看扩展状态。

**字段**：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| Mira 后端地址 | `http://localhost:3000` | 桌面端 Fastify 服务地址 |
| 默认标签 | `[]` | 每次剪藏自动附加的标签（如 "稍后读"） |

**状态显示**：

- 连接测试按钮：发 `GET /health` 或 `GET /api/clippings` 到配置地址，显示"已连接"或"无法连接"。

---

## 通信协议

### 扩展 ↔ 后端 API

沿用 DESIGN.md 定义的接口，扩展侧增加 `screenshot` 可选字段：

**`POST /api/clippings`**

```json
{
  "url": "https://example.com/article",
  "title": "文章标题",
  "selectedText": "用户选中的文字（可选）",
  "tags": ["AI", "工具"],
  "note": "这篇写得不错",
  "favicon": "https://example.com/favicon.ico",
  "screenshot": "data:image/png;base64,iVBORw0KGgo..."  // 可选，视口截图
}
```

> **screenshot 策略**：
> - 默认不走截图（URL 爬取最干净、最省空间）。
> - 用户可在 Side Panel 主动切换为"截图保存"模式。
> - 后端收到 screenshot 后**跳过爬虫**，直接走 VLM 提取文字。
> - screenshot 存本地文件系统（如 `~/.mira/screenshots/{id}.png`），SQLite 只存路径。

**响应**：

```json
// 202 Accepted
{
  "id": "a1b2c3d4...",
  "status": "pending",
  "message": "已加入爬取队列"
}
```

**错误处理**：

| 场景 | Side Panel 展示 |
|------|-----------|
| 后端未启动（ECONNREFUSED） | "无法连接到 Mira 桌面端，请确认应用已启动" |
| 后端返回 4xx | 直接展示后端返回的错误消息 |
| 后端返回 5xx | "Mira 服务暂时不可用，请稍后重试" |
| 网络超时（> 5s） | "连接超时，请检查网络或后端状态" |

### 扩展内部通信

```
chrome.tabs.query ──┐
                    ├──→ chrome.scripting.executeScript ──→ content.js
chrome.action.onClicked ──┘                                   │
                                                              │ sendMessage
                                                              ▼
                                                       Side Panel
                                                              │
                                                              │ fetch()
                                                              ▼
                                                         后端 Fastify
```

---

## UI 状态机

Side Panel 的剪藏分区保留以下状态：

```
[LOADING] ──获取页面信息──→ [READY]
                               │
                    点击保存   │
                               ▼
                         [SAVING] ──成功──→ [SUCCESS] ──继续留在侧栏
                               │
                               └─失败──→ [ERROR] ──用户点击──→ [READY]
```

各状态 UI 表现：

| 状态 | 标题区 | 表单 | 保存按钮 | 底部提示 |
|------|--------|------|----------|----------|
| LOADING | 只读，显示"加载中..." | 禁用 | 禁用，显示 spinner | "正在读取页面信息..." |
| READY | 可编辑 | 可编辑 | 可用 | 空或显示后端连接状态 |
| SAVING | 禁用 | 禁用 | 禁用，显示 spinner | "正在保存..." |
| SUCCESS | 禁用 | 禁用 | 禁用，显示 ✓ | "已保存到 Mira！"（绿色） |
| ERROR | 可编辑 | 可编辑 | 可用 | 红色错误文字 |

---

## 样式方案

**不引入 CSS 框架**。单文件 `popup.css`，约 150 行，遵循：

- 使用 CSS Variables 定义颜色，方便后续适配暗色模式。
- 基础变量：
  ```css
  :root {
    --bg: #ffffff;
    --fg: #1a1a1a;
    --muted: #6b7280;
    --border: #e5e7eb;
    --primary: #4f46e5;
    --primary-hover: #4338ca;
    --danger: #dc2626;
    --success: #16a34a;
    --radius: 6px;
    --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  ```
- 暗色模式（预留，Phase 2 实现）：
  ```css
  @media (prefers-color-scheme: dark) {
    :root { --bg: #18181b; --fg: #fafafa; ... }
  }
  ```

---

## 开发 & 调试流程

1. **本地加载**：
   - Chrome → 扩展管理 (`chrome://extensions/`) → 打开"开发者模式" → "加载已解压的扩展程序" → 选择 `extension/` 文件夹。

2. **修改重载**：
   - 修改 `popup/` 或 `options/`：保存后在 `chrome://extensions` 重新加载扩展，再重新打开侧栏。
   - 修改 `background.js` 或 `manifest.json`：需要点击扩展卡片上的刷新按钮（Service Worker 会重启）。

3. **调试**：
   - Side Panel：在 `chrome://extensions` 打开扩展的活动视图 DevTools。
   - Service Worker：扩展卡片 → Service Worker 链接 → 打开 DevTools。
   - Content Script：在网页本身的 DevTools → Sources → Content scripts。

4. **打包发布**（Phase 2）：
   - 扩展管理 → "打包扩展程序" → 生成 `.crx` 和 `.pem`。
   - 或直接在 Chrome Web Store 开发者后台上传 zip。

---

## MVP 检查清单

| # | 项 | 优先级 |
|---|-----|--------|
| 1 | manifest.json + 图标 | P0 |
| 2 | content.js 读取页面信息 | P0 |
| 3 | popup.html 表单 + 标签芯片 | P0 |
| 4 | popup.js 采集 + POST 到后端 | P0 |
| 5 | 错误处理（后端未启动等） | P0 |
| 6 | options.html 后端地址配置 | P1 |
| 7 | background.js 右键菜单 | P1 |
| 8 | 快捷键 Ctrl/Cmd+Shift+S | P1（manifest 已配置，默认生效） |
| 9 | 暗色模式 | P2 |
| 10 | 标签自动补全 | P2 |
| 11 | 选中文字直接右键剪藏（静默保存） | P2 |

---

## 与后端接口的衔接

扩展侧发给后端的契约（已清洗，后端直接入库）：

```
POST /api/clippings
Content-Type: application/json

Body: {
  url,                    // 原始 URL
  title,                  // 页面标题（用户可编辑）
  selectedText?,          // 用户选中文字
  tags[],                 // 标签
  note?,                  // 备注
  favicon?,               // favicon URL

  // 扩展侧已清洗的数据（新增）
  contentMarkdown,        // 提取后的正文 Markdown
  contentPlainText,       // 纯文本版本
  excerpt?,               // 摘要
  author?,                // 作者
  siteName?,              // 网站名
  coverImageUrl?,         // 封面图
  wordCount,              // 字数

  // 截图模式（可选）
  screenshot?             // Base64 PNG，后端 VLM 提取覆盖 contentMarkdown
}

Response: 202 Accepted + { id, status, message }
```

后端收到后直接入库，**不再发 HTTP 请求爬取**。`contentMarkdown` 为空时才需要后端兜底（极少发生）。

---

## 下一步

1. **确认本设计** → 确认后我可以输出完整的扩展骨架代码。
2. **并行推进后端 API** → 按 DESIGN.md 实现 `POST /api/clippings` 和 SQLite 建表。
3. **先实现一个可点击的 HTML 原型** → 用纯 HTML 模拟 Side Panel 交互，确认 UI 布局。

你倾向怎么推进？或者对上面的设计有什么要调整的（比如标签交互方式、快捷键、是否保留选项页）？

---

## WebBridge 浏览器 Agent 设计补充

Status: Design supplement
Scope: 触界浏览器执行端 + Mira 桌面端本地 WebSocket 通道
Related: Kimi WebBridge、Chrome DevTools MCP、Playwright MCP

当前实现状态：浏览器侧已实现 WebSocket / Native Messaging 两种传输、连接握手、当前标签页解析、四类工具执行和错误返回；Mira 后端已提供 `/webbridge` 本地 WebSocket 中继，桌面端 Agent/MCP 适配器已接入。

### 1. 目标

WebBridge 让 Mira 的 Agent 可以通过当前已登录的 Chrome 浏览器完成有限的真人式操作。触界作为浏览器侧执行端，桌面端作为本地连接和调用方。

WebBridge 与剪藏是两条独立链路：

```text
用户主动剪藏
    触界 Side Panel → 现有剪藏 HTTP 接口 → Mira 数据层

Agent 操作浏览器
    Mira 桌面端 → 本地 WebBridge UI 通道 → 触界 Service Worker → 当前页面

    Native 模式：触界 Service Worker → Native Messaging → MiraWebBridgeHost → 本机 IPC → Mira 后端

网站剪藏规则由 Mira 前端微应用管理，但不属于浏览器工具：

```text
Mira 前端“剪藏”tab
    → WebBridge UI 控制消息（clip_rules_get / clip_rules_set / clip_region_pick）
    → WebBridge 服务端按用户转发
    → 触界 Service Worker
    ├── 规则读写 → chrome.storage.sync
    └── 区域点选 → 当前 Chrome 页面 content script
```

`clip_rules_get` 和 `clip_rules_set` 只读写规则，不聚焦 Chrome、不注入页面。`clip_region_pick` 由用户点击 Mira 中的区域选择按钮触发，扩展聚焦当前 Chrome 页面并进入可见的点选模式；它不是 LLM 工具，也不会自动触发剪藏。规则同步失败时，前端保留当前编辑状态并显示错误；扩展未连接时禁止保存。
Agent 不拥有 `clip.save` 工具，也不能因为读取页面或完成网页操作而自动触发剪藏。用户仍然通过触界侧栏、快捷键或右键菜单确认剪藏。

#### 网站区域点选

1. 用户在 Mira 的“剪藏”tab 点击“选择正文区域”或“添加排除区域”。
2. 扩展切换到 Chrome 当前网页；鼠标经过的候选区域会显示高亮边框。
3. 用户可直接点击确认，也可用浮动工具条的“上一级”扩大区域，再点“确认”；“取消”或 Esc 退出且不修改规则。
4. Content Script 为确认区域生成内部定位信息，并返回 hostname、URL 和可读摘要。Mira 只展示标签、文字预览、元素数量和图片数量，不展示定位表达式。
5. 用户点击“保存网站规则”后，规则才写入 `chrome.storage.sync`。规则至少要求 hostname 完全匹配；填写 URL 匹配规则后，还必须匹配完整的 `location.href`。

内部定位信息是扩展执行细节，不是用户配置方式。旧规则如果没有可读摘要仍可执行，但 Mira 会提示用户重新点选，以补齐可读信息。

URL 匹配规则默认使用通配符：`*` 匹配任意长度文本，`?` 匹配一个字符。例如 `https://example.com/articles/*` 匹配该路径下的页面。切换到正则模式后使用 JavaScript `RegExp` 表达式文本，不填写正则标志；示例 `^https://example\\.com/articles/\\d+$` 只匹配文章数字编号页面。旧版没有 `urlPatternMode` 的规则继续按正则解释。

### 2. 产品边界

WebBridge 是浏览器操作通道，不是浏览器测试平台、DevTools 全量代理或个人自动化编排系统。

设计目标支持：

- 读取当前页面的语义化快照和必要的页面信息
- 打开 URL、后退、前进、刷新、滚动和翻页
- 点击、悬停、拖拽和处理页面弹窗
- 填写表单、选择选项和发送键盘操作
- 上传本地文件
- 获取截图或页面结果的本地资源引用

当前插件实现已覆盖连接、页面观察、截图、页面操作和文件传输。原生浏览器弹窗仍需要单独启用 `chrome.debugger` 权限，当前返回明确的未启用错误。

第一阶段不支持：

- 自动剪藏到 Mira
- 任意 JavaScript 执行
- 后台监听所有标签页
- 全量 Console、Network、Performance 或 Memory 工具
- 自动修改浏览器设置、扩展或用户权限
- 多步骤工作流持久化和无人值守调度

### 3. 工具抽象

LLM 只看到少量按真人意图划分的工具。Chrome API、DOM 查询、消息转发和等待逻辑属于扩展内部实现。

| 工具 | 真人用途 | 主要模式 |
|------|----------|----------|
| `look` | 看 | `page`、`snapshot`、`element`、`screenshot` |
| `browse` | 翻、去、返回 | `open`、`back`、`forward`、`reload`、`scroll`、`paginate`、`wait` |
| `act` | 点、输入、选择 | `click`、`hover`、`drag`、`fill`、`select`、`press`、`dialog` |
| `transfer` | 上传、下载 | `upload`、`download` |

“保存”不单独定义为工具：点击网站内的保存按钮属于 `act.click`，保存网页文件属于 `transfer.download`，保存到 Mira 的剪藏仍然是用户主动操作。

#### 3.1 `look` 与稳定元素引用

Agent 应先通过 `look` 获取页面快照，再使用快照中的稳定引用执行操作。Agent 不应每次自行猜测 CSS Selector。

```json
{
  "tool": "look",
  "params": {
    "mode": "snapshot",
    "target": "active",
    "include": ["title", "url", "text", "interactive"]
  }
}
```

结果使用短引用标识交互元素：

```json
{
  "elements": [
    { "ref": "e17", "role": "button", "name": "下一页" },
    { "ref": "e18", "role": "textbox", "name": "搜索" }
  ]
}
```

随后调用：

```json
{
  "tool": "act",
  "params": {
    "mode": "click",
    "ref": "e17",
    "after": { "wait": "navigation" }
  }
}
```

引用只对对应页面状态有效。页面发生导航或结构明显变化后，扩展应使旧引用失效，并返回“需要重新观察”的可执行错误。

#### 3.2 参数模式

工具默认采用简单参数，高级控制通过可选字段提供：

```json
{
  "tool": "act",
  "params": {
    "mode": "fill",
    "fields": [
      { "ref": "e18", "value": "Chrome WebBridge" },
      { "ref": "e19", "value": "research" }
    ],
    "submit": "Enter",
    "after": {
      "wait": "networkIdle",
      "timeoutMs": 5000,
      "include": ["snapshot"]
    }
  }
}
```

一次填写多个字段应优先使用批量模式，减少往返和中间状态。坐标操作只作为无法建立元素引用时的受限模式，不作为默认定位方式。

### 4. 运行时架构

```text
┌──────────────────── Mira 桌面端 ────────────────────┐
│  Agent / MCP Adapter                                 │
│        │                                              │
│  WebBridge Request Router                             │
│        │ WebSocket（仅本机，UI 观察与请求）             │
└────────┼─────────────────────────────────────────────┘
         ▼
┌────────────────────── 触界 ─────────────────────────┐
│  background service worker                            │
│  ├── WebSocket / Native Messaging client              │
│  ├── active tab resolver                              │
│  ├── content execution bridge                        │
│  └── user clipping flow（独立）                       │
└────────┼─────────────────────────────────────────────┘
         ▼
      当前页面
```

桌面端负责连接管理、调用路由、权限确认和 Agent 侧协议适配。扩展负责当前标签页定位、页面快照、DOM 交互和浏览器文件选择器。两侧都不把 WebBridge 请求写入剪藏数据表。

WebSocket 服务由 Mira 桌面端启动，监听地址必须是本机地址，端口来自授权码解出的 backend URL 或现有运行时配置，不在扩展代码中重复硬编码。扩展只连接 `127.0.0.1` 或 `localhost`，不接受来自公网的 WebSocket 连接。

Native 模式的启动方向固定为“扩展 Service Worker → `chrome.runtime.connectNative()` → Native Host”。桌面端不能直接调用 Chrome 扩展 API，也不再通过打开 `chrome-extension://` 页面进行激活。扩展只保持一个 WebSocket 或 Native Port。Native Host 通过本机 IPC 接入 Mira：`native_ready` 表示 Chrome 与 Host 的 Port 已就绪，Mira IPC 断开时 Host 保持该 Port 并自行重连；`hello_ack` 只完成 backend 的扩展会话注册、工具和能力同步，不作为 Native Port 的存活条件。

### 5. WebSocket 协议

WebSocket 使用统一调用信封，不为每个底层动作建立独立消息类型：

```json
{
  "version": 1,
  "id": "req_123",
  "type": "request",
  "tool": "look",
  "params": {
    "mode": "page",
    "target": "active",
    "include": ["title", "url", "text"]
  }
}
```

成功响应：

```json
{
  "version": 1,
  "id": "req_123",
  "type": "response",
  "ok": true,
  "result": {
    "url": "https://example.com",
    "title": "Example",
    "text": "..."
  }
}
```

失败响应必须给出机器可判断的错误码和人可读的处理建议：

```json
{
  "version": 1,
  "id": "req_123",
  "type": "response",
  "ok": false,
  "error": {
    "code": "STALE_ELEMENT_REF",
    "message": "页面已变化，需要重新观察页面",
    "retryable": true,
    "suggestedAction": "look"
  }
}
```

保留三类连接消息：

- `hello`：扩展声明协议版本、扩展版本和能力集合
- `status`：连接、断开、当前页面变化等状态事件
- `request` / `response`：带 `id` 的工具调用和结果

### 6. 连接与安全

WebSocket 连接必须满足：

1. 只监听本机地址。
2. 首次连接通过桌面端生成的一次性配对码或随机连接令牌完成认证。
3. 认证信息不写入 URL，不记录到普通日志。
4. 扩展断线后采用指数退避重连，不使用轮询；认证失效时停止重连，并在扩展状态中显示连接状态。
5. 主应用退出、用户明确断开或扩展重载时，立即使连接失效。
6. 工具调用默认只允许当前活动标签页；未来增加多标签页时必须显式指定目标。
7. WebBridge 不把页面内容、Cookie、令牌或截图发送到外部服务；它们只在本机调用链中流转。

WebBridge 的连接和页面读取由扩展声明的页面脚本与 `scripting` / host 权限完成，不依赖桌面端主动打开扩展页面。Chrome 内部页、扩展页等受限页面仍然不能注入；用户主动剪藏仍通过触界侧栏、快捷键或右键菜单触发。

`chrome.debugger`、全站点 host 权限和任意脚本执行属于额外风险，不作为第一阶段默认能力。若后续确实需要 DevTools 级调试，必须单独评估权限、用户提示和数据暴露范围。

### 7. 结果与资源

返回结果遵循“短摘要优先”：

- 页面状态返回标题、URL、关键文本和可操作元素
- 操作成功返回状态变化摘要，必要时附带新的快照
- 截图、下载文件等大对象返回本地资源引用，不在 JSON 中内嵌大段 Base64
- 页面正文超过限制时返回截断摘要和资源引用

示例：

```json
{
  "ok": true,
  "result": {
    "summary": "已点击下一页，页面已加载第 2 页",
    "url": "https://example.com/page/2",
    "snapshotRef": "local-resource://webbridge/snapshot/abc123"
  }
}
```

### 8. 错误分类

| 错误码 | 含义 | 建议处理 |
|--------|------|----------|
| `BRIDGE_DISCONNECTED` | 主应用或扩展未连接 | 重新建立连接 |
| `AUTH_REQUIRED` | 未完成配对或令牌失效 | 由用户重新确认连接 |
| `NO_ACTIVE_TAB` | 没有可操作的当前标签页 | 提示用户切换页面 |
| `UNSUPPORTED_PAGE` | Chrome 内部页、扩展页等不可注入页面 | 明确告知不可操作 |
| `STALE_ELEMENT_REF` | 页面状态已变化 | 重新调用 `look` |
| `TARGET_NOT_FOUND` | 找不到目标元素 | 返回当前快照或建议观察 |
| `ACTION_TIMEOUT` | 页面未在规定时间内完成 | 返回当前页面状态 |
| `USER_CONFIRMATION_REQUIRED` | 操作需要用户确认 | 停止执行并等待用户 |
| `FILE_ACCESS_DENIED` | 文件路径不可访问 | 要求用户选择或授权文件 |

### 9. 分阶段范围

#### Phase 1：连接与观察

- 本地 WebSocket 连接和认证
- `hello`、`status`、`look.page`、`look.snapshot`
- 当前活动标签页的标题、URL、文本和交互元素引用
- 连接状态和错误展示

#### Phase 2：基础真人操作

- `browse.open/back/forward/reload/scroll`
- `act.click/fill/select/press`
- 操作后等待和返回摘要
- 表单批量填写

#### Phase 3：文件与增强观察

- `transfer.upload/download`（插件侧已实现；桌面端需传入文件数据或接收下载结果）
- 截图资源引用
- 页面弹窗、拖拽和受限坐标操作

暂不安排 Console、Network、Performance、任意脚本和自动剪藏。它们不是第一阶段 WebBridge 的必要条件。

### 10. 验收标准

设计落地后必须能证明：

1. 触界能和本地 Mira 桌面端建立并维持 WebSocket 连接。
2. Agent 可以读取当前活动页面的语义化快照。
3. Agent 可以使用快照引用完成点击和表单填写。
4. 页面变化后旧引用会失效，并返回可执行的重新观察建议。
5. WebBridge 不会自动触发触界剪藏。
6. 断线、未配对、不可注入页面和操作超时都有明确错误结果。
7. 现有用户主动剪藏流程、HTTP 接口和剪藏数据模型保持不变。
8. 点击 Mira 中的“连接”不会打开未知扩展页面；扩展自行连接并向 Mira 页面报告在线状态。

### 11. 设计依据

- Chrome DevTools MCP 的设计原则强调 Agent 无关、语义化结果、小而确定的工具块、自愈错误和渐进式复杂度。
- Chrome 官方 Native Messaging：<https://developer.chrome.com/docs/extensions/develop/concepts/native-messaging>
- Chrome 官方 Service Worker 生命周期：<https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle>
- Chrome DevTools MCP 的输入自动化使用页面快照产生的元素引用，并支持批量表单填写。
- Playwright MCP 将核心浏览器自动化与 Network、Storage、DevTools、Vision 等能力分开，并支持通过浏览器扩展连接现有浏览器标签页。
- Kimi WebBridge 采用本地服务加浏览器扩展的组合，主应用通过本地通道驱动现有浏览器，保持登录态和页面内容在本机。
