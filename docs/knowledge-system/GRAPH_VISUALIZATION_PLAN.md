# 图谱可视化方案

Status: Current
Owner: docs
Last verified: 2026-06-24
Layer: schema
Module: docs-system
Doc Type: design

## 目的

说明这套知识库从简单笔记图到结构化知识图的完整可视化策略。

## 适合什么时候读

- 想知道每一层可视化分别适合什么问题
- 想在 note graph 和 knowledge graph 之间做选择
- 想设计从 markdown 链接到关系图谱的演进路径

## 当前事实

- 当前 markdown 语料已经支持文件树浏览。
- 基于链接的可视化，现在就能在 Obsidian 或 Logseq 里做。
- 真正的结构化图谱可视化，需要额外的图投影层。

## 可视化层次

### 第一层：文件树

适合：

- 确定性导航
- 看 area 归属
- 快速按目录扫描

最适合的工具：

- Obsidian 文件树
- 编辑器文件树

### 第二层：笔记链接图

适合：

- backlink 浏览
- 单主题 local graph
- 非正式地发现相关文档

最适合的工具：

- Obsidian local graph
- Logseq graph view

### 第三层：概念图

适合：

- 看哪些概念在多篇文档里反复出现
- 把 `runtime`、`role`、`chat`、`knowledge-base` 这类主题聚类起来
- 识别哪些概念还缺 canonical page

需要的数据：

- 概念抽取
- 概念到文档的连接
- 文档到文档的连接

### 第四层：知识图谱

适合：

- 结构化地探索实体和关系
- 跨 area 做影响分析
- 对契约、功能和依赖做图查询

最适合的工具：

- Neo4j Bloom
- 同类图探索界面

## 建议节点类型

- `Document`
- `Section`
- `Concept`
- `Area`
- `CodeAnchor`
- `Status`
- `Owner`

## 建议边类型

- `LINKS_TO`
- `MENTIONS`
- `BELONGS_TO_AREA`
- `REFERENCES_CODE`
- `HAS_STATUS`
- `OWNED_BY`
- `RELATED_TO`

## 使用原则

- 想确认事实，用文件树。
- 想快速跳读，用 note graph。
- 想收敛概念，用 concept map。
- 只有当关系分析确实重要时，才上 knowledge graph。

## 推荐搭配

- 日常阅读：`Obsidian`
- 跨文档概念探索：`Obsidian + 概念页`
- 深层关系分析：`Neo4j Bloom`

## Related Docs

- `VISUALIZATION_AND_AI_ACCESS.md`
- `KNOWLEDGE_SYSTEM_FULL_PLAN.md`
- `FULL_MCP_AND_INDEX_ARCHITECTURE.md`
