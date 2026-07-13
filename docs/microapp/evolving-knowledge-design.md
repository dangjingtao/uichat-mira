# 智识进化库 (Evolving Knowledge) 微应用设计文档

Status: Draft
Owner: Tomz / Claude
Last updated: 2026-07-11
Layer: design
Doc Type: spec

---

## 1. 产品定位

**不是传统 RAG。当前交付范围聚焦图文，不包含音频和视频处理。**

传统 RAG：问 → 检索 → 答。

智识进化库：
> 收集（多媒体） → AI 自我整理 → 概念关联 → 洞见进化 → 可被对话引用

灵感来源：Andrej Karpathy 的"原子化笔记 + 时间线 + 概念碰撞"方法论。

---

## 2. 核心概念

### 2.1 捕获 (Capture)
- 来源：Chrome 插件一键剪藏
- 当前内容类型：**文本 + 图片**
- 捕获后行为：完整原文作为证据入库，AI 另行生成"卡帕西式重写"，用于组织、检索和观点归纳

### 2.2 整理 (Organization)
- **动态标签**：AI 实时生成，不建分类树。标签会演化（今天叫"LLM Agent"，下周合并进"Agentic AI"）
- **实体提取**：从内容中抽概念实体（人名、技术、方法论）
- **用户干预**：用户可以在插件弹窗里编辑 AI 生成的重写和标签

### 2.3 关联 (Relation)
- 系统主动发现内容之间的关系：
  - `similar` — 相似主题
  - `contradicts` — 知识冲突
  - `evolves` — 演进关系
  - `references` — 引用关系
- 不依赖用户手动打链接

### 2.4 洞见 (Insight)
- AI 定期扫描知识库，生成 4 类洞见：

| 类型 | 描述 | 示例 |
|---|---|---|
| **Synthesis** | 跨文本与图片主题聚合 | "你本周收藏的文章和图片都在讲同一件事：Agent 的确定性危机" |
| **Contradiction** | 知识冲突发现 | "7/5 的文章认为长上下文取代一切，7/10 的论文证明结构化记忆仍必要" |
| **Resurfacing** | 跨时间演进追踪 | "30天前你收藏的 ReAct → 今天的 MemoryBank，形成 Action→Reflection→Memory 演进线" |
| **Gap** | 知识缺口指出 | "你看了问题和困境，但没看 observability 和测试策略" |

---

## 3. 数据模型

### 3.1 knowledge_captures

```
id              TEXT PRIMARY KEY
source_url      TEXT
title           TEXT
favicon         TEXT
captured_at     TEXT (ISO 8601)

content_type    TEXT  -- text | image
raw_content     TEXT  -- 完整原文 / Markdown 图片引用 / OCR 结果
rewritten_summary TEXT  -- AI 卡帕西式重写

ai_tags         TEXT  -- JSON: string[]
ai_entities     TEXT  -- JSON: [{name, type, context}]
user_edited     INTEGER  -- 0/1，用户是否干预过重写或标签

capture_metadata TEXT  -- JSON: {author, publishedAt, domain, ...}
created_at      TEXT
updated_at      TEXT
```

### 3.2 knowledge_attachments

```
id              TEXT PRIMARY KEY
capture_id      TEXT REFERENCES knowledge_captures
file_path       TEXT
mime_type       TEXT
ai_extracted_text TEXT  -- 图片 OCR 或视觉描述
processing_status TEXT  -- done | pending | failed
created_at      TEXT
```

### 3.3 knowledge_tags_evolution

```
tag_name        TEXT
user_id         INTEGER REFERENCES users(id)
first_seen_at   TEXT
last_seen_at    TEXT
usage_count     INTEGER
merged_into_tag TEXT  -- 标签合并记录
merged_at       TEXT
```

### 3.4 knowledge_relations

```
id              TEXT PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
source_capture_id TEXT REFERENCES knowledge_captures
target_capture_id TEXT REFERENCES knowledge_captures
relation_type   TEXT  -- similar | contradicts | evolves | references
confidence      REAL  -- 0.0 ~ 1.0
ai_reasoning    TEXT  -- AI 为什么认为两者有关系
created_at      TEXT
```

### 3.5 knowledge_insights

```
id              TEXT PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
insight_type    TEXT  -- synthesis | contradiction | resurfacing | gap
title           TEXT
description     TEXT
trigger_capture_id TEXT  -- 哪条捕获触发了这个洞见
related_capture_ids TEXT  -- JSON: string[]
related_concept_ids TEXT  -- JSON: string[]
dismissed_by_user INTEGER  -- 0/1，用户是否关闭
confidence      REAL
created_at      TEXT
expires_at      TEXT  -- 洞见有时效性
```

---

## 4. 后端服务架构

| 服务 | 职责 | 同步/异步 |
|---|---|---|
| `CaptureService` | 接收 Chrome 插件数据，分发到处理管道 | 同步 |
| `TextProcessor` | 文本摘要、动态标签、实体提取、重写 | 同步（<3s） |
| `ImageProcessor` | 使用已有 OCR 文本或视觉描述形成图片证据 | 同步 |
| `InsightEngine` | 定期跑：关系发现、矛盾检测、洞见生成 | 定时任务 |
| `EvolvingKnowledgeRag` | 把 captures + insights 包装成 RAG 源 | 请求时 |

### 4.1 Chrome 插件 API

```
POST /microapps/evolving-knowledge/captures
```

**文本捕获：**
```json
{
  "sourceUrl": "...",
  "title": "...",
  "favicon": "...",
  "contentType": "text",
  "rawContent": "...",
  "metadata": { "author": "...", "publishedAt": "..." }
}
```
→ 返回：`{ id, rawContent, rewrittenSummary, aiTags, aiEntities, processingStatus }`。

**图片捕获：**
先通过现有 `POST /attachments` 上传图片，再以 JSON 提交：
```json
{
  "sourceUrl": "...",
  "title": "...",
  "contentType": "image",
  "rawContent": "正文和 Markdown 图片引用",
  "attachments": [{ "filePath": "/attachments/...png", "mimeType": "image/png" }]
}
```
→ 返回：`{ id, rawContent, rewrittenSummary, aiTags, processingStatus }`。

音频和视频不是当前协议的合法 `contentType`，后续阶段另行设计，不属于当前验收范围。

### 4.2 InsightEngine 触发逻辑

- 每次新捕获入库后，触发**轻量级关系检测**（只和最近 50 条比较）
- 每晚定时任务：全库扫描，生成**深度洞见**
- 洞见去重：相同 `insight_type` + 相同 `trigger_capture_id` 组合，7 天内不重复生成

---

## 5. 前端 Studio 设计

### 5.1 路由

```
/settings/micro-apps/evolving-knowledge-studio
```

### 5.2 页面结构

```
┌─────────────────────────────────────────────────────┐
│  🔔 洞见面板（可折叠，顶部显示最近 3-5 条洞见）        │
├─────────────────────────────────────────────────────┤
│  🔍 搜索栏（全文 + 标签 + 概念 + 时间范围）           │
├─────────────────────────────────────────────────────┤
│  📊 统计看板（本周新增 / 主题分布 / 活跃概念）        │
├─────────────────────────────────────────────────────┤
│  ⏱️ 时间线（主轴）                                    │
│                                                     │
│  ┌─ 7/9  📄 论文 ── SWE-bench Verified              │
│  │   [标签: Benchmark, Code Agent]                   │
│  │   [关联: 📄 7/1 文章 → 观点撕裂]                  │
│  │   [AI 重写摘要...]                                │
│  │                                                   │
│  ├─ 7/6  🖼️ 图片 ── Agent 记忆结构                  │
│  │   [标签: Memory, Agent]                            │
│  │   [关联: 📄 7/3 文章 → 共同主题: 试错迭代]        │
│  │                                                   │
│  └─ ...                                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.3 交互设计

- **时间线**：按时间倒序，每条内容显示文本或图片图标（📄🖼️）
- **关联卡片**：悬停或点击展开"相关旧识"横向关联
- **洞见卡片**：可 dismiss（不再显示），可 pin（固定在顶部）
- **搜索**：支持自然语言（"我收藏的关于 Agent 调试的内容"）

---

## 6. RAG 集成

和普通知识库并列，但检索逻辑不同：

| 模式 | 检索策略 |
|---|---|
| **原始内容召回** | 向量相似度搜 captures 的 rewritten_summary |
| **洞见层召回** | 先搜 insights（AI 已整理好的概念/矛盾/趋势），再定位到 captures |
| **混合模式** | 用户问"我最近在看什么" → 走洞见层；问"某篇文章说了什么" → 走原始层 |

---

## 7. 关键设计决策（已对齐）

| # | 决策 | 说明 |
|---|---|---|
| 1 | 完整原文作为证据保存，AI 重写独立存储 | 重写用于整理和检索，原文用于引用、复核和观点证据链 |
| 2 | 动态标签，不要分类树 | AI 实时生成，可演化合并 |
| 3 | 前端做时间线 + 关联流 | 不做复杂力导向图谱 |
| 4 | 洞见 4 类 | Synthesis / Contradiction / Resurfacing / Gap |
| 5 | Contradiction 温和呈现 | 指出冲突 + 建议深挖，不说"你信错了" |
| 6 | 用 Gap 替代 Trend | 指出知识缺口，不预测用户行为 |
| 7 | 当前聚焦图文 | 音频和视频不进入当前协议与验收范围 |
| 8 | Chrome 插件即时反馈 | 当前只要求文本和图片同步返回 |
| 9 | 独立 Studio 工作台 | 不在聊天窗口里，在 /settings/micro-apps/ 下 |
| 10 | 复用现有基础设施 | LLM provider、embedding、SQLite、Drizzle、前端组件 |

---

## 8. 开发节奏（建议）

### Phase 1：骨架
- [ ] 数据库表（captures, attachments, tags_evolution, relations, insights）
- [ ] Capture API（文本捕获 + 同步 AI 重写）
- [ ] 微应用注册进 runtime
- [ ] Studio 壳子（时间线页面，静态数据）

### Phase 2：音视频处理（未来阶段）

本阶段不进入当前交付范围。以下能力保留为未来选项，不阻塞当前图文基础建设：

- Audio/Video 异步处理管道
- Whisper 转写、视频抽帧和音轨处理
- 音视频附件播放器与失败重试

图片仍属于当前范围：网页图片、图片 URL、已有 OCR 文本或视觉描述均可作为图文证据进入后续洞见、概念和观点处理；本阶段不单独建设通用媒体队列。

### Phase 3：洞见引擎
- [ ] 图文实体与概念提取，保留到原始 capture 的证据引用
- [ ] 关系检测（similar / contradicts / evolves / references）
- [ ] 新捕获轻量扫描 + 全库深度扫描两级 InsightEngine
- [ ] Synthesis / Contradiction / Resurfacing / Gap 完整生成
- [ ] 洞见去重、过期、dismiss、pin 和重新生成语义

验收条件：

- 每条关系和洞见都能回到具体 capture，不允许生成无来源洞见
- 重复扫描不会持续产生语义相同的洞见
- 单条处理失败不影响 capture 入库，并留下可诊断状态
- 图文捕获可以共同参与主题聚合和矛盾发现

### Phase 4：进化
- [ ] 标签演化（别名、合并、拆分、用户否决）
- [ ] 概念节点去重与概念关联流可视化
- [ ] 从多条洞见归纳核心观点，并保存证据与反证
- [ ] 核心观点版本化：形成、强化、修订、分裂、废弃
- [ ] 用户可确认、修订或否决观点，不直接覆盖历史版本

验收条件：

- 概念不是标签字符串的简单堆叠，同义概念应可合并并保留别名
- 核心观点必须同时保存支持证据、反对证据、置信度和版本历史
- 新证据进入后只能生成新版本，不可静默改写旧观点
- Studio 默认展示可读的概念关联流和观点演进时间线，不做复杂力导向图

### Phase 5：RAG
- [ ] 包装成对话可选择的洞见知识源
- [ ] 双重召回（原始图文证据 + 洞见/核心观点）
- [ ] 根据问题意图选择事实检索、观点检索或混合检索
- [ ] 回答展示 capture、洞见和观点版本的引用链

验收条件：

- “某篇文章说了什么”优先返回原始图文证据
- “我对某主题形成了什么认识”优先返回核心观点及版本变化
- “有哪些冲突或空白”优先返回 Contradiction / Gap，并附相关 capture
- 回答中的核心观点不可脱离证据单独出现

### 8.1 Phase 3-5 数据流

```text
图文 Capture
  -> 实体、动态标签和候选概念
  -> Capture 关系与四类洞见
  -> 概念去重、别名和关联
  -> 核心观点 + 支持证据 + 反对证据
  -> 观点版本演进
  -> 原始证据层 / 洞见观点层双重召回
  -> 对话引用
```

### 8.2 Phase 4 新增核心模型

#### knowledge_concepts

保存稳定概念节点、别名、首次和最近出现时间。概念节点独立于动态标签，标签可以演化并映射到概念。

#### knowledge_concept_edges

保存概念间的 `related`、`part_of`、`contradicts`、`evolves` 和 `references` 关系，并保留来源 capture 与置信度。

#### knowledge_viewpoints

保存核心观点当前状态，包括标题、规范化陈述、状态、当前版本、置信度和用户确认状态。

#### knowledge_viewpoint_versions

保存每次观点形成或修订的不可变版本。版本必须记录触发原因、支持证据、反对证据和创建时间。

#### knowledge_viewpoint_evidence

连接观点版本与 capture / insight，标记证据立场为 `supports`、`opposes` 或 `context`。

---

## 9. 待讨论问题

- [ ] 标签演化时，用户是否有 veto 权？（AI 建议合并两个标签，用户可拒绝）
- [ ] Gap 洞见是否允许用户"标记为已补"？
- [ ] 洞见的时效性：一条 Contradiction 洞见应该存在多久？
- [ ] 图片缺少 OCR 文本或视觉描述时，是否只保存图片 URL 与页面上下文？
- [ ] Chrome 插件的权限范围（是否允许访问所有网站的 DOM？）
