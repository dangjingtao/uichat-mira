# Clippings（剪藏）模块设计

Status: Draft  
Owner: browser-extension / data-ingestion / text2sql-engine  
Layer: design-doc  
Doc Type: feature-design  
Canonical: true  

## 单点真相范围

这页只回答一件事：

在 UIChat Mira 的"日常个人 AI 工作台"定位下，**Clippings（剪藏）** 是什么，它从哪里来，到哪里去，和 Text2SQL 是什么关系。

它覆盖：

- Clippings 的产品定位（不是微应用，是数据采集能力）
- Chrome 扩展的职责边界与数据流
- 后端爬虫策略与存储模型
- Text2SQL 的分析场景
- 与现有 news_hub、mail_center、text2sql-engine 的协同关系

它不覆盖：

- 具体的 Chrome Extension manifest v3 实现代码
- 爬虫的 HTML 解析器内部算法
- text2sql-engine 的 LLM prompt 设计
- 桌面端 Studio 的 React 组件实现

## 结论先说

**Clippings 不是微应用。**

它是"个人数据资产层"的一个**主动采集入口**。用户通过 Chrome 扩展标记"这个页面对我有价值"，后端爬取并清洗内容，存入本地 SQLite，最终成为 Text2SQL 可分析的结构化数据。

当前语境下：

- `news_hub` 是系统推送给用户的（RSS 抓取）
- `mail_center` 是别人发给用户的（IMAP 拉取）
- `clippings` 是用户主动选择留下的（Chrome 扩展 + 后端爬虫）

三者共同构成"个人工作台的信息全景"，但只有 clippings 是**用户意图的直接表达**。

## 为什么不是微应用

回顾 MicroAPP 的定义：

> MicroAPP 是一套可以被复用、可以被注册、可以被不同接入点消费的**成熟业务工作流**。

Clippings 不符合这个定义，因为：

1. 它不提供"业务工作流"——它不回答问题、不生成图片、不操作界面。
2. 它的输出不是给接入点消费的——它的输出是**结构化数据**，供 text2sql-engine 查询。
3. 它的 value 不在 invoke() 里——它的 value 在"采集 → 清洗 → 存储 → 分析"的完整链路里。

所以 Clippings 的定位是：

- **数据采集能力**（浏览器扩展）
- **内容治理管道**（后端爬虫 + 清洗）
- **个人记忆资产**（本地 SQLite 表）

## 系统架构

```text
┌─────────────────────────────────────────────────────────────┐
│                        Chrome 扩展                           │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  图标点击    │    │  快捷键触发  │    │  右键菜单"收藏"  │  │
│  └──────┬──────┘    └──────┬──────┘    └────────┬────────┘  │
│         └──────────────────┼────────────────────┘            │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Popup: 标题/选中文字预览 + 标签输入 + 备注 + [保存]  │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│                       ▼                                     │
│  POST /api/clippings  │  {url, title, selectedText,       │   │
│                       │    tags, note, favicon}             │   │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                     桌面端 Fastify 后端                       │
│                                                             │
│  1. 接收 clipping 请求 → 写入 `clippings` 表（status=pending）│
│  2. 触发异步爬虫任务                                         │
│  3. 返回 202 Accepted                                        │
│                                                             │
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  /api/clippings  │    │  /api/clippings/:id/scrape      │ │
│  │  (CRUD + 列表)   │    │  (触发/重试爬虫)                │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  爬虫服务（异步，内部模块）                               │ │
│  │  - node-fetch 抓取 HTML                                 │ │
│  │  - @mozilla/readability 提取正文                        │ │
│  │  - turndown HTML → Markdown                             │ │
│  │  - 可选：LLM 生成摘要                                   │ │
│  │  - 更新 `clippings` 表（status=success/failed/paywall） │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│              本地 SQLite: `clippings` 表                      │
│                                                             │
│  - 用户主动标记的元数据（url, title, tags, note）            │
│  - 爬虫清洗后的内容（content_markdown, excerpt）             │
│  - 阅读状态（read_status, reading_progress）                 │
│  - 采集与爬取审计（created_at, scrape_status）               │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    text2sql-engine                           │
│                                                             │
│  Schema 精简描述（脱敏后） → LLM → SQL → 只读查询           │
│                                                             │
│  可查询的数据源：                                            │
│  - `clippings`（剪藏内容）                                   │
│  - `news_items`（新闻中心）                                  │
│  - `mail_messages`（邮件中心）                               │
│  - 用户上传的 CSV / SQLite                                  │
└─────────────────────────────────────────────────────────────┘
```

## 后端职责（已简化）

### 做什么

1. **接收结构化数据**：`POST /api/clippings` 接收扩展发来的已清洗数据
2. **直接入库**：写入 `clippings` 表，无需额外爬取
3. **VLM 兜底**：收到 `screenshot` 时，跳过爬取，用 VLM 提取文字覆盖 `contentMarkdown`
4. **提供查询接口**：`GET /api/clippings` 列表查询

### 不做什么

1. **不主动 fetch URL**：扩展已提供清洗后的 Markdown，后端不再发 HTTP 请求
2. **不做 HTML 解析**：Readability / turndown 逻辑已迁移到扩展侧

### 做什么

1. **监听用户主动动作**：图标点击、快捷键、右键菜单
2. **读取当前页面元数据**：URL、title、favicon、用户选中的文字
3. **提取并清洗正文**：在 content script 中用 `extractor.js` 提取正文区 → 去噪 → 转 Markdown
4. **提供轻量 UI**：让用户输入标签和备注，预览提取内容
5. **发送结构化数据到后端**：通过 HTTP POST 到桌面端 Fastify 服务（携带已清洗的 Markdown）

### 不做什么

1. **不读取完整浏览历史**：只采集用户主动标记的页面
2. **不静默监控**：没有后台脚本持续扫描标签页
3. **不做最终存储**：数据归集到桌面端 SQLite
4. **不处理复杂爬取**：扩展只处理当前可见页面，不主动 fetch 其他 URL

### 权限最小化

```json
{
  "permissions": [
    "activeTab",
    "storage"
  ],
  "host_permissions": [
    "http://localhost:*/",
    "http://127.0.0.1:*/"
  ]
}
```

只请求 `activeTab`（当前标签页），不请求 `history`、`tabs`、`webNavigation` 等敏感权限。

## 数据模型：`clippings` 表

```sql
CREATE TABLE clippings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  url TEXT NOT NULL,
  canonical_url TEXT,              -- 规范化 URL（去 utm 参数）
  title TEXT NOT NULL DEFAULT '',
  excerpt TEXT,                    -- 摘要（Readability 或 LLM 生成）
  author TEXT,
  site_name TEXT,                  -- 网站名，如 "V2EX"

  -- 用户输入
  user_note TEXT,                  -- 用户备注
  user_tags_json TEXT NOT NULL DEFAULT '[]',
  user_selected_text TEXT,         -- 用户在页面上高亮的文本

  -- 爬取内容
  content_markdown TEXT,           -- Readability 清洗后的正文（或 VLM 提取）
  content_plain_text TEXT,         -- 纯文本版本（用于检索）
  word_count INTEGER,
  screenshot_path TEXT,            -- 本地截图文件路径（PNG）

  -- 元数据
  favicon_url TEXT,
  cover_image_url TEXT,            -- 文章头图（Open Graph）

  -- 状态
  scrape_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (scrape_status IN ('pending', 'success', 'failed', 'paywall')),
  scrape_error TEXT,

  -- 阅读状态（用户在工作台里的操作）
  read_status TEXT NOT NULL DEFAULT 'unread'
    CHECK (read_status IN ('unread', 'reading', 'archived', 'abandoned')),
  reading_progress REAL,           -- 0.0 ~ 1.0

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 索引
CREATE INDEX idx_clippings_site_name ON clippings(site_name);
CREATE INDEX idx_clippings_read_status ON clippings(read_status);
CREATE INDEX idx_clippings_created_at ON clippings(created_at);
CREATE INDEX idx_clippings_scrape_status ON clippings(scrape_status);
```

## 爬虫策略

### 扩展侧核心库（浏览器内）

| 模块 | 用途 |
|------|------|
| `extractor.js` | 浏览器 DOM 正文提取 + HTML 清洗 + Markdown 转换 |

### 后端保留库（仅用于 VLM 兜底和 CLI 工具）

| 库 | 用途 |
|---|------|
| `node-fetch` | CLI 爬虫抓取原始 HTML（向后兼容） |
| `jsdom` | CLI 爬虫 DOM 环境 |
| `@mozilla/readability` | CLI 爬虫正文提取 |
| `turndown` | CLI 爬虫 HTML → Markdown |

### 爬取流程（已迁移到扩展侧）

```
扩展 content script 读取当前页 DOM
    ↓
extractor.js（文本密度法）提取正文区
    ↓
清洗 HTML（去脚本/样式/导航）
    ↓
转 Markdown（保留 h1-h6, p, ul, a, img 等）
    ↓
POST { url, title, contentMarkdown, contentPlainText, excerpt, ... } 到后端
    ↓
后端直接写入 SQLite，不再爬取
```

**扩展提取失败时？**
```
正文提取为空？
    ↓ 是
有 screenshot？
    ↓ 是
后端 VLM 提取文字 → Markdown
    ↓
写入 clippings.content_markdown
```

### 失败降级

| 场景 | 处理 |
|------|------|
| 网页反爬（Cloudflare） | 以 `user_selected_text` 作为 fallback content，标记 `paywall` |
| SPA 页面（HTML 无内容） | MVP 不处理，标记 `failed`，后续可接 Playwright 渲染 |
| 爬取超时（10s） | 中断，标记 `failed` |
| 图片 | 正文 Markdown 里保留 `![alt](url)` 引用，并通过本地附件接口持久化可读取的图片 |
| 爬取完全失败 | 如有 screenshot → 桌面端 VLM 提取文字 → Markdown；如无 → `failed` |

## Text2SQL 的分析场景

### 单表查询

```sql
-- 这周收藏了什么？
SELECT title, site_name, created_at
FROM clippings
WHERE created_at > datetime('now', '-7 days')
ORDER BY created_at DESC;

-- 哪个网站被我收藏最多？
SELECT site_name, COUNT(*) as count
FROM clippings
GROUP BY site_name
ORDER BY count DESC
LIMIT 10;

-- 稍后读积压超过 3 个月的有多少？
SELECT COUNT(*)
FROM clippings
WHERE read_status = 'unread'
  AND created_at < datetime('now', '-90 days');

-- 收藏了但爬虫失败的有哪些？
SELECT title, url, scrape_error
FROM clippings
WHERE scrape_status = 'failed';
```

### 交叉分析（和现有数据）

```sql
-- "新闻中心推给我的 AI 文章，和我自己收藏的 AI 文章，有多少重合？"
-- 需要 `news_items` 和 `clippings` 按 URL 或标题相似度匹配

-- "我标注了 'AI' 标签但还没读的"
SELECT title, excerpt, user_note
FROM clippings
WHERE user_tags_json LIKE '%AI%'
  AND read_status = 'unread';
```

## 隐私设计

| 原则 | 实现 |
|------|------|
| 主动选择 | 只采集用户点击图标/快捷键/右键菜单时标记的页面，不静默监控 |
| 本地存储 | 所有数据存入桌面端本地 SQLite，不上传任何外部服务器 |
| 用户可控 | 提供删除单条、清空所有、导出 JSON 功能 |
| 无跟踪 | 不记录"用户看了什么"，只记录"用户选择保存了什么" |
| 透明 | 扩展图标显示"已保存 X 条"，让用户感知数据积累 |

## MVP 范围

### Phase 1：最小可用

1. **Chrome 扩展**
   - manifest v3
   - popup：标题预览 + 标签输入 + 备注 + [保存到 Mira]
   - 快捷键触发（如 `Cmd+Shift+S`）

2. **后端接口**
   - `POST /api/clippings` — 接收并入库（status=pending）
   - `GET /api/clippings` — 列表查询
   - 异步爬虫任务（内部触发，无独立路由）

3. **爬虫**
   - node-fetch + Readability + turndown
   - 失败时以 `user_selected_text` fallback

4. **数据表**
   - `clippings` 表（如上文 schema）

### Phase 2：产品化

1. 桌面端 Clippings Studio 页面
   - 列表 + 阅读器 + 标签管理
   - Text2SQL 自然语言查询面板

2. 和 text2sql-engine 集成
   - `clippings` 表加入内置数据源列表
   - schema 脱敏后喂给 LLM

3. 高级扩展功能
   - 右键菜单"收藏选中文字"
   - 批量导入当前窗口所有 tab
   - 阅读进度自动保存

### Phase 3：协同

1. 和 `news_hub` 交叉分析（"系统推的 vs 我留的"）
2. 和 `mail_center` 联动（从邮件提取文章链接，自动加入 clippings）
3. 全文检索 / 向量检索接入（`sqlite-vec` / `orama`）

## 与现有产品的关系

| 现有模块 | 关系 |
|---------|------|
| `news_hub` | `news_hub` 是系统推送给用户的外部信息。clippings 是用户主动选择留下的信息。两者可在 text2sql 中交叉分析"信息消费全景"。 |
| `mail_center` | 邮件中常有技术通讯（Newsletter）和文章分享链接。未来可从邮件解析 URL，自动加入 clippings 待爬队列。 |
| `text2sql-engine` | text2sql 的分析价值依赖于"有结构化的个人数据"。clippings 是它最重要的**外部数据源**之一（用户自己产生的数据资产）。 |
| MicroAPP 体系 | clippings 不注册为 `MicroAppDefinition`，不进入 `microapps/runtime.ts` 注册表。它是底层数据采集能力，不是业务工作流。 |

## 当前最重要的落地判断

现在先不要把 clippings 做成大而全的"个人知识管理"平台。

第一阶段只需要立住这四件事：

1. Chrome 扩展只采集用户主动标记的页面，权限最小化。
2. 后端爬虫用 Readability 清洗正文，失败有降级。
3. 数据只存本地 SQLite，不上传。
4. `clippings` 表成为 text2sql-engine 的内置数据源之一。

做到这四条，用户的"个人数据资产层"就有了第一个主动入口，text2sql 也从"查新闻和邮件"升级为"查我自己的收藏"。
