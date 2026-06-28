# 目录与归类规则

Status: Current
Owner: docs
Last verified: 2026-06-25
Layer: schema
Module: Docs
Feature: DocsSystem
Doc Type: current-contract
Canonical: true
Related:
  - ../WIKI_SYSTEM_SCHEMA.md
  - DOCUMENTATION_STANDARDS.md
  - KNOWLEDGE_SYSTEM_INDEX.md
  - UNCATEGORIZED_TRACKER.md

## 单点真相范围

这页定义知识库在“逻辑上怎么分组”，即使物理目录还在渐进整理中，也优先按这套口径理解。

它主要回答：

- 哪些文档属于哪个逻辑 area
- 哪些文档是当前契约，哪些只是实现说明或历史材料
- 新文档应该优先往哪类目录收

这页的归类策略也受这条上位原则约束：

- [karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

也就是说，归类规则不只是为了人类目录整洁，更是为了让 AI 更自然地理解：

- 这是哪个模块
- 这是哪种文档
- 它属于现状、计划、执行还是历史

相关概念：

- [[CONCEPT_DOCS]]
- [[CONCEPT_INDEX]]
- [[KNOWLEDGE_SYSTEM_INDEX]]

## 适合什么时候读

这些场景建议先看这页：

- 给文档做索引、标签或 AI 暴露范围时
- 判断一篇文档应该放哪层
- 清理“根目录什么都堆一点”的情况
- 区分当前真相页和历史参考页

## 归类原则

### 先按逻辑 area 看，再按物理目录看

目录结构很重要，但它不是唯一真相。

如果一篇文档物理上还在根目录，而内容上已经明显属于某个 area，那么：

- 先按逻辑 area 理解它
- 再决定是否需要迁移目录

### 入口页、真相页、补充页要分开

一套好读的文档通常至少分三层：

- 入口页：告诉你从哪里开始
- 真相页：定义当前系统的稳定边界
- 补充页：解释实现、维护、计划或研究

不要让所有页面都同时承担三种职责。

### `archive/` 默认不参与当前真相

`archive/` 只作为历史背景材料。

除非：

- 现行代码验证了它
- 或当前活跃文档再次确认了它

否则不要把 archive 当成当前系统真相。

### 模块归属和文档角色要分成两轴

后续不要再把“模块”和“文档形态”混在一起理解。

应该分成两轴：

- 第一轴：模块归属
  - 例如 `Chat`、`Role`、`KnowledgeBase`、`Tool`、`MCP`
- 第一轴半：功能点归属
  - 例如 `Thread`、`ToolIntegration`、`MarkdownWorkspace`、`ExternalMarketplace`
- 第二轴：文档角色
  - 例如 `plan`、`design`、`checklist`、`draft`、`current-contract`、`reference`

这样才更符合 [karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 这类长期知识库思路，也更适合 AI 阅读。

其中：

- `Module` 是顶级功能域
- `Feature` 是模块内的具体功能点
- `Feature` 当前允许为空，但字段应正式存在

### 站点阅读入口也要分成两轴

文档站不要再只把目录树直接投影成阅读入口。

人类阅读至少要同时看到两套视角：

- 状态维度
  - 先读这里
  - 正在实施
  - 规划中
  - 历史归档
- 模块维度
  - `Chat`
  - `ModelSetting`
  - `KnowledgeBase`
  - `Role`
  - `Tool`
  - `MCP`
  - `Docs`
  - `Develoments`
  - 其他稳定业务域

一句话：

- 状态维度回答“现在该怎么看”
- 模块维度回答“这篇在讲谁”

不要把这两个维度混成一个目录层级。

### `专题文档` 只允许作为待归类兜底

根目录里暂时还没有归进稳定逻辑 area 的文档，可以继续物理存在。

但在逻辑上：

- `专题文档` 不应再被当成正式长期主分类
- 它更像 `待归类`
- 后续应持续把其中页面收进更明确的模块或状态分组

也就是说：

- 可以存在根目录散页
- 但不能让“根目录散页集合”主导人类和 AI 的阅读入口

## 逻辑 Area 映射

当前推荐的逻辑 area：

| Area | 典型路径 |
| --- | --- |
| `architecture` | `architecture/` 下各页，以及仍在根目录但实际描述运行时设计的页面 |
| `platform` | `platform/` |
| `chat` | `chat/README.md`、`uchat.md`、`uchat-internal-maintenance.md`、`chat/chat-system-practices.md` |
| `role` | `role/README.md`、`role/role-api.md`、`role/page.md` |
| `knowledge-base` | `knowledge-base/README.md`、`knowledge-base/api.md`、`knowledge-base/backend-schema.md`、`knowledge-base/markdown-workspace-mode.md` |
| `providers` | `provider/README.md`、`architecture/provider-api-standards.md`、`architecture/provider-proxy-api.md`、`architecture/provider-integration-optimization.md` |
| `tooling-runtime` | `tooling-runtime/harness-runtime-design.md`、`tooling-runtime/read-skill-design.md`、`architecture/external-mcp-marketplace.md` |
| `developments` | `developments/` 下各页，以及仍在迁移中的开发支撑类根目录镜像页 |
| `planning` | `developments/product-roadmap-priorities.md` 以及仍未落地的路线类页面 |
| `knowledge-system` | `knowledge-system/` 下关于索引、阅读范围、可视化、MCP 暴露的页面 |
| `historical` | `archive/` 及明确已过期但保留背景价值的页面 |

上表描述的是逻辑 area，不等于长期顶级 `Module`。当前顶级 `Module` 统一收为：

- `Chat`
- `ModelSetting`
- `MCP`
- `Tool`
- `KnowledgeBase`
- `Role`
- `Docs`
- `Develoments`

映射口径先固定如下：

- `chat` area -> `Chat`
- `role` area -> `Role`
- `knowledge-base` area -> `KnowledgeBase`
- `provider` 相关页 -> `ModelSetting`
- `tooling-runtime` 中以内置工具为主的页 -> `Tool`
- `tooling-runtime` 中以外部 MCP / MCP product 为主的页 -> `MCP`
- `knowledge-system` -> `Docs`
- `architecture / platform / evaluation / planning / bugfix / developments` 先统一 -> `Develoments`

## 内容类型映射

推荐内容类型：

| Class | 含义 |
| --- | --- |
| `current-contract` | 当前运行时、API 或系统边界的权威说明 |
| `reference` | API、schema、标准、字段说明等查阅型页面 |
| `feature-overview` | 子系统或工作流的整体说明 |
| `implementation-notes` | 维护、落地、排障、操作细节 |
| `planned-design` | 已明确方向但尚未完全落地的设计 |
| `historical` | 历史方案、归档材料、已过期背景 |
| `asset-catalog` | 资源目录、素材说明、非核心文本支撑页 |

## 默认判断提示

一般情况下：

- `README.md`、`VAULT_HOME.md` 更像入口页
- `architecture/README.md`、`uchat.md`、`role/README.md` 这类总纲页通常属于 `current-contract`
- API / schema / 字段定义页通常属于 `reference`
- 维护记录、迁移说明、操作文档通常属于 `implementation-notes`
- 路线图、未来能力设计通常属于 `planned-design`
- `archive/` 下页面永远归 `historical`

## 现在这批容易混的页面

### `tooling-runtime/harness-runtime-design.md`

- 逻辑 area：`tooling-runtime`
- 当前类型：`planned-design`

原因：它定义方向很关键，但还不是现网稳定 contract。

### `tooling-runtime/read-skill-design.md`

- 逻辑 area：`tooling-runtime`
- 当前类型：`planned-design`

### `architecture/external-mcp-marketplace.md`

- 逻辑 area：`tooling-runtime`
- 当前类型：`planned-design`

### `knowledge-system/*`

大多数属于：

- 逻辑 area：`knowledge-system`
- 类型：`current-contract` 或 `reference`

因为这部分已经在指导当前文档组织与 AI 阅读方式。

## 新文档放置建议

如果一篇文档主要在回答：

- “系统现在就是这样工作的”  
  优先放到对应 area 的总纲或 contract 层。

- “以后准备这么做”  
  放到对应 area，但标成 `planned-design`。

- “这是一次迁移、接线、维护说明”  
  优先放 area 内部，而不是再堆回根目录。

- “这是开发支撑规则、版本、请求封装、i18n、缺陷或路线治理”  
  优先放 `developments/`，不要继续留在根目录做长期正文。

同时还要再问一遍：

- 这篇属于哪个模块？
- 这篇是什么文档角色？

目录层级只能回答一部分，不能代替这两个问题。

## 当前收纳方向

当前文档整理的方向不是“所有文件名立刻重命名一遍”，而是：

- 先让入口页和真相页稳定
- 再把明显属于某 area 的文档逐步下沉
- 最后再处理剩余根目录散页

而从下一阶段开始，更核心的方向会变成：

- 把模块归属讲清
- 把文档角色讲清
- 让 AI 不靠猜就能理解文档位置与用途

## 当前落地口径

现在每篇活跃文档至少应满足：

- 能说出主模块
- 能说出主功能点，或者明确暂时为空
- 能说出文档角色
- 能说出它属于哪一层
- 能说出它是 current 还是 historical

如果一篇文档同时像多个模块，不要平均分类，只给一个主模块：

- `Chat` 负责聊天系统
- `Role` 负责角色系统
- `KnowledgeBase` 负责知识库内容与工作区
- `ModelSetting` 负责模型配置、provider 与模型接线
- `Tool` 负责内置工具与工具运行时
- `MCP` 负责外部 MCP 接入与 MCP 暴露面
- `Docs` 负责文档系统、schema、索引、阅读规则与知识系统治理
- `Develoments` 负责 runtime、platform、evaluation、规划、bugfix 与工程支撑

如果无法稳定决定主模块：

1. 先看这篇文档最终服务哪个功能域
2. 再看它是不是总纲页、参考页、设计页还是排障页
3. 最后才考虑目录位置

这套规则的目标不是目录好看，而是让 AI 能稳定回答：

- 这是什么模块
- 这是哪个功能点
- 这是哪种文档
- 这篇是当前真相还是历史背景

## 站点分组建议

如果文档站要开始稳定消费这套规则，推荐首页至少分成下面几块：

### 状态维度

- 先读这里
  - `current-contract`
  - `overview`
  - `reference`
  - 入口页 / 总纲页 / canonical truth page
- 正在实施
  - `checklist`
  - 明确仍在 active 状态的实施页
- 规划中
  - `plan`
  - `draft`
  - 尚未成为当前契约的设计页
- 历史归档
  - `historical`
  - `archive/`

### 模块维度

- 按 `Module` 分组展示
- 每组优先展示该模块最像入口页或总纲页的那一篇
- 同一模块下的 `plan / checklist / historical` 不应盖过 `current-contract / overview`

### 待归类

- 只保留为补充区
- 用来承接仍未稳定归并的根目录页
- 不再作为主导航第一层

这样读者和 AI 都更容易建立稳定路径。

## 相关文档

- `AI_READING_SCOPE.md`
- `INDEX_SCHEMA.md`
- `KNOWLEDGE_SYSTEM_FULL_PLAN.md`
- `VISUALIZATION_AND_AI_ACCESS.md`
