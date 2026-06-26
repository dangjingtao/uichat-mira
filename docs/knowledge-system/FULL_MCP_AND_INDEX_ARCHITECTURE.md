# MCP 与索引完整架构

Status: Current
Owner: docs
Last verified: 2026-06-24
Layer: schema
Module: docs-system
Doc Type: design

## 目的

说明这套知识系统面向 AI 的完整接入架构，包括：

- 文档加载
- 元数据索引
- 全文检索
- 语义检索
- MCP 暴露面

## 适合什么时候读

- 想把这套文档暴露给多个 AI 客户端
- 不满足于“直接读文件”
- 想设计一套更严肃的检索和上下文供给层

## 当前事实

- Markdown 仍然是唯一真相源。
- MCP 是接口层，不是存储层。
- 所有 AI 可见结果都应该保留 source path 级别的可追溯性。
- 默认暴露面应优先按 `Layer / Module / Doc Type / Status` 过滤，而不是只靠路径前缀猜内容。

## 核心组件

### Document Loader

负责：

- 扫描批准目录
- 忽略排除路径
- 规范化路径
- 解析顶部元数据块
- 切分 section

### Metadata Index

记录：

- 文件路径
- 标题
- status
- owner
- section 列表
- tags
- 链接到的文档
- 引用到的代码路径
- 最近索引时间
- layer
- module
- doc type
- canonical
- related

### Full-Text Index

支持：

- 精确短语搜索
- heading 感知搜索
- area 过滤搜索
- status 过滤搜索

### Semantic Index

支持：

- 活跃文档上的相似语义检索
- section 粒度的向量检索
- 按需扩展到概念邻接

### MCP Server

负责向 AI 暴露：

- 主题资源
- 文档读取工具
- 搜索工具
- 必要时的预设 prompts / flows

## 资源模型

完整资源模型建议至少包括：

- `kb://index`
- `kb://areas/architecture`
- `kb://areas/platform`
- `kb://areas/role`
- `kb://areas/chat`
- `kb://areas/knowledge-base`
- `kb://areas/providers`
- `kb://areas/prompt-manager`
- `kb://concepts/<name>`
- `kb://doc/<normalized-path>`
- `kb://status/current`
- `kb://status/planned`
- `kb://status/historical`

资源暴露策略建议：

- current-contract 和 reference 优先
- historical 默认不进主上下文
- 跨模块文档只暴露一个主模块视图

## 工具模型

完整工具模型建议至少包括：

- `list_areas`
- `list_docs`
- `read_doc`
- `read_section`
- `search_docs`
- `search_by_status`
- `search_by_owner`
- `related_docs`
- `doc_links`
- `concept_neighbors`

## 检索策略

默认检索策略：

- 优先 `Status: Current`
- 优先架构和参考文档，而不是 roadmap / defect 类文档
- 默认排除 `archive/`
- 所有结果都附带 source path 和 section 信息

回退检索策略：

- 如果活跃文档无法回答问题，再扩展到 planned 文档
- 只有还不够时，才显式回落到历史文档

## Section 粒度策略

索引和检索都建议至少做到 section 粒度，而不是只按整篇文件。

原因：

- 技术文档经常一篇里包含多个契约
- section 粒度能明显减少噪音
- 引用会更精确

## 审计性要求

每条 AI 可见结果都至少带：

- 规范化 source path
- 文档标题
- section heading
- status
- owner

## 同步模型

索引刷新触发条件建议包括：

- 文件创建
- 文件修改
- 文件删除
- 定时重建

索引层必须是派生层，可以随时重建；markdown 语料层才是唯一真相源。

## 最小落地接入面

如果团队想先做一层轻量接入，再逐步长成完整架构，可以先从下面这些资源开始：

- `kb://index`
- `kb://areas/architecture`
- `kb://areas/chat`
- `kb://areas/role`
- `kb://areas/knowledge-base`
- `kb://areas/platform`

第一批工具只保留：

- `list_docs`
- `read_doc`
- `search_docs`

即使是轻量接入面，也要遵守这些约束：

- 默认排除 `archive/`
- 文本读取默认排除 `assets/`
- 结果必须返回 source path
- markdown 始终是唯一真相源

## Related Docs

- `KNOWLEDGE_SYSTEM_FULL_PLAN.md`
- `AI_READING_SCOPE.md`
