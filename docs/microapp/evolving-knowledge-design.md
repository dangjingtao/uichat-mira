# 智识进化库 (Evolving Knowledge) 微应用设计文档

Status: Draft
Owner: Tomz / Claude
Last updated: 2026-07-18
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
- 当前产品形态：**统一的知识条目**，不向用户提供文本、图片或多媒体分类
- 剪藏内容可以同时包含 Markdown 正文和图片附件，图片是正文中的媒体资源，不是另一类知识
- 捕获后行为：先把本地化后的完整原文作为证据入库，再由 AI 生成结构化摘要和知识编译结果，用于组织、检索和观点归纳

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

content_type    TEXT  -- 统一分类：webpage；图片作为网页正文中的媒体资源
raw_content     TEXT  -- 完整本地化 Markdown 原文，图片引用指向本地附件
rewritten_summary TEXT  -- AI 生成的结构化摘要

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
ai_extracted_text TEXT  -- 预留字段；当前阶段不生成 OCR 或视觉描述
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
| `ImageProcessor` | 当前只维护图片附件和原文媒体引用，不做 OCR 或视觉理解 | 不启用 |
| `InsightEngine` | 定期跑：关系发现、矛盾检测、洞见生成 | 定时任务 |
| `EvolvingKnowledgeRag` | 把 captures + insights 包装成 RAG 源 | 请求时 |

### 4.1 Chrome 插件 API

```
POST /microapps/evolving-knowledge/captures
```

剪藏必须形成一份与线上来源解耦的本地快照。Mira 服务端不能只接收网页 URL 后再回源抓取，因为登录态、反爬策略、页面变化和图片失效都会破坏快照一致性。

**统一剪藏流程：**

```text
插件读取当前页面 DOM
  -> Readability 提取网页主体和元数据
  -> 收集图片并上传到 Mira /attachments
  -> 请求 Mira，提交主体内容、元数据和本地图片映射
  -> Mira 服务端使用 Turndown 生成 Markdown
  -> 将 Markdown 中的图片引用替换为本地 /attachments/ 地址
  -> 先保存完整原文快照
  -> AI 分析摘要、标签、实体和关系
  -> 保存 AI 派生结果
```

AI 分析失败不能影响原文快照入库。原始 Markdown、来源信息和附件是证据层；摘要、标签、实体、关系和洞见是可重新生成的派生层，不能覆盖原始正文。

**统一剪藏请求：**

```json
{
  "sourceUrl": "...",
  "title": "...",
  "favicon": "...",
  "extractedHtml": "...",
  "contentType": "webpage",
  "attachments": [
    { "filePath": "/attachments/...png", "mimeType": "image/png", "sourceUrl": "..." }
  ],
  "metadata": { "author": "...", "publishedAt": "..." }
}
```

服务端转换和保存后返回：`{ id, rawContent, attachments, rewrittenSummary, aiTags, aiEntities, processingStatus }`。

插件负责获取页面主体和图片，因为它拥有当前浏览器页面的 DOM、登录态和资源访问上下文；Mira 负责统一 Markdown 规范化、图片引用本地化、原文保存和 AI 分析。音频和视频暂不进入当前剪藏协议，但不改变“统一知识条目”的产品模型。

### 4.2 InsightEngine 触发逻辑

- 每次新捕获入库后，触发**轻量级关系检测**（只和最近 50 条比较）
- 定时任务按批次处理待编译或受新证据影响的范围，生成**深度洞见**；不默认对全库重复调用模型
- 用户明确发起“全量重建”时，才允许按批次执行全库任务，并记录断点、模型版本和成本
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
│  ┌─ 7/9  知识条目 ── SWE-bench Verified              │
│  │   [标签: Benchmark, Code Agent]                   │
│  │   [关联: 📄 7/1 文章 → 观点撕裂]                  │
│  │   [AI 重写摘要...]                                │
│  │                                                   │
│  ├─ 7/6  知识条目 ── Agent 记忆结构                  │
│  │   [标签: Memory, Agent]                            │
│  │   [关联: 📄 7/3 文章 → 共同主题: 试错迭代]        │
│  │                                                   │
│  └─ ...                                             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 5.3 交互设计

- **时间线**：按时间倒序统一展示知识条目；图片作为正文媒体或附件展示，不作为独立分类
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
| 8 | Chrome 插件即时反馈 | 当前要求本地化图文快照同步返回 |
| 9 | 独立 Studio 工作台 | 不在聊天窗口里，在 /settings/micro-apps/ 下 |
| 10 | 复用现有基础设施 | LLM provider、SQLite、Drizzle、前端组件；洞见候选筛选暂不引入 embedding |
| 11 | 本地化图文快照 | 插件获取主体和图片，Mira 转 Markdown 并先保存原文，再保存 AI 派生结果；产品上不提供文本/图片分类 |
| 12 | 增量知识编译 | 原始 capture 是事实源，主题、洞见和观点是可版本化派生层；新证据只更新受影响范围 |
| 13 | 借鉴 LLM Wiki 思路 | 参考 [Karpathy 的 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)，采用原始资料、持久化知识层、schema 和维护日志三层思路；不照搬文件系统实现 |

---

## 8. 开发节奏（建议）

### Phase 1：骨架
- [ ] 数据库表（captures, attachments, tags_evolution, relations, insights）
- [ ] Capture API（统一剪藏快照 + 同步 AI 重写）
- [ ] 微应用注册进 runtime
- [ ] Studio 壳子（时间线页面，静态数据）

### Phase 2：音视频处理（未来阶段）

本阶段不进入当前交付范围。以下能力保留为未来选项，不阻塞当前图文基础建设：

- Audio/Video 异步处理管道
- Whisper 转写、视频抽帧和音轨处理
- 音视频附件播放器与失败重试

图片仍属于当前范围：网页图片和图片 URL 随网页正文作为附件保存，保留原文媒体引用；当前不做 OCR、视觉描述或通用媒体队列。

### Phase 3：知识编译基础

本阶段借鉴 Karpathy 的 LLM Wiki 思路，但不把 Markdown 文件或图数据库作为系统事实源。数据库中的原始捕获是事实源，AI 生成的摘要、标签、关系和知识页是可重建的派生层。

目标是把“新增一条资料”从一次性摘要调用变成可重复的增量编译任务：新资料进入后，只处理可能受影响的概念、关系和洞见，不默认全量重建。

- [ ] 原始 Markdown、图片附件和来源元数据作为不可变证据保存
- [x] 将正文拆成可引用的事实单元，并保存原文定位；图片只保留为原始附件，不做 OCR 或视觉理解
- [ ] 建立知识编译 schema，约束摘要、实体、关系、洞见和证据的输出格式
- [x] 用标签、实体、标题、摘要和正文关键词重叠生成候选材料，模型只分析候选集合
- [ ] TF-IDF 或 embedding 候选检索：当前不引入，待数据规模和召回质量证明现有筛选不足后再评估
- [ ] 实现新捕获轻量扫描和按批次深度扫描两级任务
- [ ] 生成 `Synthesis`、`Contradiction`、`Resurfacing`、`Gap` 四类洞见
- [ ] 任务支持幂等、断点、失败记录、模型版本、输入范围和成本记录
- [ ] 洞见支持去重、过期、dismiss、pin 和重新生成
- [ ] 增加知识库健康检查：缺少证据、重复关系、孤立概念和过期洞见

验收条件：

- 每条关系和洞见都能定位到具体 capture、事实单元或图片证据
- 新资料只更新候选相关范围，不因单条采集触发无边界全库模型调用
- 重复执行同一编译任务不会产生重复的关系、洞见或版本
- 单条 AI 处理失败不影响原始证据入库，并留下可诊断的任务状态
- 图文资料可以共同参与主题聚合、关系分析和证据引用
- 可以从任务记录重现本次编译使用的输入、schema、模型和结果

### Phase 4：持久化知识与观点演进

本阶段把 Phase 3 的洞见编译为可持续维护的知识层。它对应 LLM Wiki 中的 wiki 层，但在 Mira 中以数据库记录和可读页面的组合实现。知识页是面向用户的持久化综合结果，不是查询时临时生成的回答。

- [ ] 标签演化：别名、合并、拆分、用户否决和历史映射
- [ ] 概念去重：将同义标签和实体映射到稳定概念，并保留来源证据
- [ ] 生成和维护主题知识页，支持一个 capture 更新多个相关主题
- [ ] 维护概念之间的 `related`、`part_of`、`contradicts`、`evolves`、`references` 关系
- [ ] 从多条有证据的洞见归纳核心观点，并同时保存支持证据和反对证据
- [ ] 核心观点版本化：形成、强化、修订、分裂、废弃
- [ ] 用户可以确认、修订、否决观点；任何修改都生成新版本，不覆盖历史版本
- [ ] 增加全局索引和追加式维护日志，记录入库、更新、冲突、查询和健康检查
- [ ] Studio 展示主题、观点和证据的可读关联流，不建设复杂力导向图作为首要交互

当前已实现第四期后端第一批：概念索引和显式合并、按概念编译主题页、主题证据关联、核心观点生成、观点版本保存、观点确认/否决接口，以及对应的前端 API 类型。Studio 的主题和观点展示、自动概念边生成仍未完成。

验收条件：

- 概念不是标签字符串的简单堆叠，同义概念合并后仍能追溯原始标签和 capture
- 一个主题页能够展示当前综合结论、证据、冲突、待解决问题和最近更新时间
- 核心观点必须同时保存支持证据、反对证据、置信度、来源范围和版本历史
- 新证据只能生成新观点版本，不允许静默改写旧观点
- 任何观点都能区分“原文事实”“模型归纳”和“用户确认”三种来源
- 删除或隐藏一条派生结果不会删除原始 capture 和附件

### Phase 5：对话查询与知识维护

本阶段把持久化知识层接入对话，但不让对话成为知识的唯一存储位置。查询优先利用已经编译的主题和观点，再回到原始证据做核验；有价值的新分析可以经过确认后回写知识层。

- [x] 提供独立的洞见知识查询接口，供对话层选择和调用
- [x] 实现原始证据、主题知识页、洞见和观点版本的关键词召回
- [x] 根据问题意图选择事实检索、主题检索、观点检索或混合检索
- [x] 查询结果返回 capture、事实单元、洞见和观点版本的引用链
- [x] 支持将高价值的比较、归纳和分析保存为新的知识页或观点版本
- [x] 支持用户发起知识库健康检查，并返回冲突、过期、孤立页和证据缺口
- [x] 记录查询命中和引用，回写必须由用户明确触发

第五期现已完成基础闭环。`POST /microapps/evolving-knowledge/query` 提供四种检索模式，
结果返回 capture、evidence unit、topic、insight 和 viewpoint version 的引用链；查询结果同时
写入用户级查询日志。`POST /microapps/evolving-knowledge/writeback` 只在用户明确调用时写入
主题或观点，观点写回永远创建新版本。`GET /microapps/evolving-knowledge/health` 返回缺少
证据的 capture、孤立主题、孤立观点和过期洞见。

对话接入通过线程级 `evolvingKnowledgeEnabled` 开关完成。开关关闭时原知识库 RAG 路径不变；
开启后跳过 embedding 和普通知识库索引，直接从洞见知识层召回，并复用现有 RAG 生成、流式事件
和引用展示。洞见检索使用已有的低成本关键词召回，不引入 OCR、TF-IDF 或 embedding。

验收条件：

- “某篇文章说了什么”优先返回原始图文证据，不用观点替代原文
- “我对某主题形成了什么认识”优先返回主题知识页和核心观点，并展示版本变化
- “有哪些冲突或空白”优先返回 `Contradiction` / `Gap`，并附相关 capture 和证据
- 回答中的核心观点不可脱离证据单独出现；没有足够证据时必须明确标记为待确认
- 查询阶段不默认修改知识库，只有用户确认或明确要求回写时才产生新知识版本
- 知识库可通过索引、日志和健康检查发现断链、过时内容和孤立内容

### 8.1 Phase 3-5 数据流

```text
本地化 Markdown + 图片附件 Capture
  -> 保存不可变原始证据
  -> 清洗、去重和拆分可引用事实单元
  -> 摘要、标签、实体和候选概念
  -> 本地检索生成候选材料
  -> 增量关系分析与四类洞见
  -> 更新受影响的主题知识页
  -> 概念去重、别名和关联维护
  -> 核心观点 + 支持证据 + 反对证据
  -> 生成不可变观点版本
  -> 原始证据层 / 知识层双重召回
  -> 对话引用或用户确认后回写
  -> 索引、日志和健康检查
```

### 8.2 Phase 3-5 核心模型

#### knowledge_evidence_units

保存从 capture 正文中拆分出的可引用事实单元。必须包含 `capture_id`、正文定位、文本内容、提取方式和处理版本。图片不经过 OCR 或视觉理解；图片证据通过 capture 附件和原文中的媒体引用保留。

#### knowledge_topics

保存可持续维护的主题知识页，包括主题名称、当前综合内容、状态、来源数量、最近更新时间和当前维护版本。主题页是 AI 生成的派生结果，不能替代原始 capture。

#### knowledge_topic_evidence

连接主题知识页与 capture / evidence unit / insight，标记证据作用为 `supports`、`opposes` 或 `context`。

#### knowledge_concepts

保存稳定概念节点、别名、首次和最近出现时间。概念节点独立于动态标签，标签可以演化并映射到概念。

#### knowledge_concept_edges

保存概念间的 `related`、`part_of`、`contradicts`、`evolves` 和 `references` 关系，并保留来源 evidence、capture 与置信度。

#### knowledge_viewpoints

保存核心观点当前状态，包括标题、规范化陈述、状态、当前版本、置信度和用户确认状态。观点只是当前版本的索引，不保存不可追溯的最终结论。

#### knowledge_viewpoint_versions

保存每次观点形成或修订的不可变版本。版本必须记录触发原因、输入范围、schema、模型信息、支持证据、反对证据、创建时间和版本状态。

#### knowledge_viewpoint_evidence

连接观点版本与 evidence unit / capture / insight，标记证据立场为 `supports`、`opposes` 或 `context`，并保留引用定位。

#### knowledge_maintenance_runs

保存一次入库编译、主题更新、观点重建或健康检查任务的批次范围、状态、断点、模型版本、成本、错误和结果摘要。它保证重建可追踪、可恢复、可审计。

---

## 9. 待讨论问题

- [ ] 标签演化时，用户是否有 veto 权？（AI 建议合并两个标签，用户可拒绝）
- [ ] Gap 洞见是否允许用户"标记为已补"？
- [ ] 洞见的时效性：一条 Contradiction 洞见应该存在多久？
- [ ] 后续是否需要独立的图片理解能力？当前阶段不纳入验收范围。
- [ ] Chrome 插件的权限范围（是否允许访问所有网站的 DOM？）
