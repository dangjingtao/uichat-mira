# 实施路线图

Status: Current
Owner: docs
Last verified: 2026-06-24
Layer: schema
Module: Docs
Feature: DocsSystem
Doc Type: plan
Canonical: true
Related:
  - ../WIKI_SYSTEM_SCHEMA.md
  - DOCUMENTATION_STANDARDS.md
  - DIRECTORY_AND_CLASSIFICATION_RULES.md
  - DOCS_REFACTOR_CHECKLIST.md

## 目的

把完整知识系统方案拆成可以排期和逐步落地的执行顺序。

## 适合什么时候读

- 想按阶段实施这套知识系统
- 想按结果而不是抽象概念来估工作量
- 想决定什么先做、什么后做

## 执行原则

- Markdown 始终是唯一编写真相源。
- 派生层必须可重建。
- 人类阅读体验和 AI 阅读体验要一起变好。
- 历史内容默认是 opt-in，而不是默认输入。

## 阶段 1：语料层就绪

目标：

- 让 markdown 语料足够稳定，能被工具可靠读取

交付物：

- 按 `DOCUMENTATION_STANDARDS.md` 收口活跃文档
- 给核心文档补上 status、owner、last-verified
- 为主要 area 明确 canonical entry docs
- 明确 archive 边界

成功标准：

- 核心文档带清晰状态
- archive 不会被误读成现状
- area 入口清楚可用

## 阶段 2：人类可视化

目标：

- 让这套语料在 Obsidian 之类工具里好读、好跳

交付物：

- `OBSIDIAN_QUICKSTART.md`
- 稳定的入口页
- 必要的概念页
- 更适合 backlink 的命名整理

成功标准：

- 从根入口到某个子系统的阅读路径足够短
- local graph 不会噪音过多

## 阶段 3：确定性索引

目标：

- 构建 metadata + section 粒度索引

交付物：

- 路径规范化规则
- section parser
- metadata parser
- 出链提取
- code anchor 提取
- 索引存储格式

成功标准：

- 每个 section 都能回指一个 source path
- status / owner 过滤稳定可用

## 阶段 4：MCP 接入层

目标：

- 通过标准 AI 接口暴露整套文档语料

交付物：

- area resources
- document resources
- read tools
- search tools
- related-doc 查询
- 带 source path 的结果引用

成功标准：

- 另一个 AI 客户端可以通过 MCP 回答仓库文档问题
- 默认读取不会把 archive 自动带上

## 阶段 5：语义检索

目标：

- 提升概念级和表达变化较大问题的召回率

交付物：

- 活跃文档的 section 粒度 embedding
- hybrid retrieval 策略
- exact / metadata / semantic 之间的排序规则

成功标准：

- 语义相近的问题能命中正确文档
- 契约型问题仍然优先走确定性结果

## 阶段 6：图谱投影

目标：

- 把语料投影成概念和关系图

交付物：

- 节点和边提取流程
- 图结构 schema
- note-link graph 视图
- 可选的图数据库投影

成功标准：

- 概念邻域可探索
- 图节点能追回 markdown 证据

## 阶段 7：治理与刷新

目标：

- 让整套系统长期保持可信

交付物：

- 刷新触发规则
- 验证检查
- owner review 节奏
- archive 迁移规则

成功标准：

- 派生索引持续与文档同步
- 当前文档长期保持“当前”

## 推荐顺序

1. 阶段 1
2. 阶段 2
3. 阶段 3
4. 阶段 4
5. 阶段 7
6. 阶段 5
7. 阶段 6

## 改造待完成

下面这份清单记录“已经明确要做，但还没有完整落地”的事项。

### A. 语料与元数据层

- [ ] 把所有活跃核心文档补齐 `Layer / Module / Doc Type`
- [ ] 把剩余活跃文档继续补齐 `Layer / Module / Doc Type`
- [ ] 统一校正旧文档中仍不一致的分类命名和文档角色
- [ ] 为更多 current-contract / reference 文档补 `Code Anchors`
- [ ] 明确哪些页面是 canonical truth page，哪些只是补充页
- [ ] 把 raw sources 和 wiki 在逻辑上彻底分开，避免概念页和原始事实页继续混读

当前进展：

- 已经完成第一批核心稳定文档元数据补齐
- `WIKI_SYSTEM_SCHEMA.md` 已正式定义三层：Raw sources / Wiki / Schema
- 但全库仍未完成全量覆盖，分类一致性也还没有完全收口

### B. 索引与文档站消费层

- [ ] 让 docs-site / 索引器直接读取 `Layer / Module / Doc Type`
- [ ] 用这些字段做导航分组、过滤和默认暴露策略
- [ ] 区分 raw-source / wiki / schema 的展示与读取优先级
- [ ] 让首页和目录不只按路径展示，还能按模块和文档角色展示
- [ ] 让“当前契约 / 参考 / 计划 / 历史”在站点里有稳定的可见区分

当前进展：

- docs-site 已能在启动和构建时自动重建索引
- 但索引目前还主要按路径组织，尚未真正消费三轴元数据

### C. AI 接入与维护层

- [ ] 把三层与三轴元数据接进 AI 读取范围和默认检索策略
- [ ] 让 MCP / 资源查询默认避开 historical 噪音
- [ ] 定义新文档 ingest 时如何判定 layer / module / doc type
- [ ] 定义 wiki 页可由 LLM 维护、raw source 不应被随意改写的规则落地方式
- [ ] 建立文档刷新、核验和 owner review 的持续机制

当前进展：

- schema 已经写清维护原则
- 但接入层和治理动作还主要停留在文档规则，尚未全部变成自动化能力

### D. 后续再做而不是现在先做

- [ ] 把 raw sources / wiki / schema 做物理目录隔离
- [ ] 建立活跃文档语义检索
- [ ] 建立图谱投影与关系探索界面

说明：

- 这些都重要，但当前优先级低于“先把核心文档元数据补齐 + 让索引器真正消费它”

## Related Docs

- `KNOWLEDGE_SYSTEM_FULL_PLAN.md`
- `OPERATING_MODEL.md`
- `INDEX_SCHEMA.md`
- `MCP_RESOURCE_AND_TOOL_SCHEMA.md`
