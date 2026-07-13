# Chrome 扩展详细设计（Mira Clipper）

Status: Draft  
Layer: design-doc / extension  
Scope: MVP Phase 1（最小可用）

Runtime boundary: the extension is Vanilla JS only. It performs basic page extraction and sends JSON captures to `/microapps/evolving-knowledge/captures`. It does not start a backend, run Python/Node services, crawl pages outside the browser, or persist files.

---

## 设计原则

1. **零构建依赖** — MVP 阶段纯 Vanilla JS，不引入 Vite/Webpack/React，降低维护成本。
2. **权限最小化** — 只申请 `activeTab`、`storage`、`scripting`，不碰 `history`/`tabs`/`webNavigation`。
3. **无状态转发** — 扩展本身不持久存储剪藏数据，只做采集和转发，数据归集到桌面端 SQLite。
4. **失败可感知** — 任何网络/权限/后端异常必须在 Popup UI 上明确提示，不静默吞错。

---

## 文件结构

```
extension/
├── manifest.json              # Manifest V3
├── background.js              # Service Worker（右键菜单、快捷键兜底、跨域请求）
├── popup/
│   ├── popup.html             # 主界面
│   ├── popup.css              # 样式（单文件，无 CSS 框架）
│   └── popup.js               # Popup 逻辑
├── content/
│   └── content.js             # Content Script（读取页面元数据、选中文字）
├── options/
│   ├── options.html           # 扩展选项页
│   ├── options.css
│   └── options.js
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

> **为什么无构建工具？**  
> 扩展总代码量预计 < 500 行，引入构建链的收益远低于维护成本。如需 TS 或代码拆分，在 Phase 2 再评估。

---

## Manifest V3

```json
{
  "manifest_version": 3,
  "name": "Mira Clipper",
  "version": "1.0.0",
  "description": "将网页剪藏到你的 Mira 个人工作台",
  "permissions": [
    "activeTab",
    "storage",
    "scripting"
  ],
  "host_permissions": [
    "http://localhost:*/",
    "http://127.0.0.1:*/"
  ],
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "剪藏当前页面到 Mira",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png"
    }
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
      "description": "打开 Mira Clipper"
    }
  },
  "options_page": "options/options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

### 权限说明

| 权限 | 用途 | 为什么不更少/更多 |
|------|------|------------------|
| `activeTab` | 获取当前标签页的 URL、title、favicon | 比 `tabs` 更精准，只针对用户正在看的页面 |
| `storage` | 保存用户偏好（后端地址、默认标签） | `localStorage` 在 Service Worker 中不可用 |
| `scripting` | 向当前页注入 content script 读取选中文字 | MV3 中读取页面 DOM 的标准方式 |
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

### 2. Popup (`popup/popup.html` + `popup.js` + `popup.css`)

**尺寸**：宽 380px，高自适应（最大 540px）。

**布局结构**：

```
┌──────────────────────────────┐
│ [favicon] 页面标题（可编辑）   │  ← 顶部元数据区
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
Popup 打开
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
后端返回 202 → 显示 "已保存" → 1.5s 后自动关闭 popup
后端返回错误 → 显示具体错误信息，恢复按钮
```

---

### 3. Background Service Worker (`background.js`)

**职责**：

1. **注册右键菜单**：安装时创建 `contextMenus`。
2. **处理右键点击**：点击后打开 popup（和图标点击行为一致）。
3. **跨域请求兜底**：若未来需要绕过某些 CSP 限制，可在 background 中发 `fetch`（拥有更广的 host 权限）。

**右键菜单设计**：

```javascript
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'mira-clipper-save-page',
    title: '剪藏页面到 Mira',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // 打开 popup 并传递标记（popup 内可通过 URL hash 或 storage 感知）
  chrome.action.openPopup();
});
```

> **MVP 决策**：右键菜单暂时只做"打开 popup"，不做静默保存。因为缺少标签/备注的剪藏价值较低，且静默保存容易让用户困惑。

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
> - 用户可在 popup 主动切换为"截图保存"模式。
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

| 场景 | Popup 展示 |
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
                                                       popup.js
                                                              │
                                                              │ fetch()
                                                              ▼
                                                         后端 Fastify
```

---

## UI 状态机

Popup 的生命周期只有 4 个状态：

```
[LOADING] ──获取页面信息──→ [READY]
                               │
                    点击保存   │
                               ▼
                         [SAVING] ──成功──→ [SUCCESS] ──1.5s──→ 关闭
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
   - 修改 `popup/` 或 `options/`：保存后点击 popup 外任意区域再重新打开即可生效。
   - 修改 `background.js` 或 `manifest.json`：需要点击扩展卡片上的刷新按钮（Service Worker 会重启）。

3. **调试**：
   - Popup：右键点击 popup → "检查" → 打开 DevTools。
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
3. **先实现一个可点击的 HTML 原型** → 用纯 HTML 模拟 popup 交互，确认 UI 布局。

你倾向怎么推进？或者对上面的设计有什么要调整的（比如标签交互方式、快捷键、是否保留选项页）？
