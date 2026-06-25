# MCP 资源与工具结构

Status: Current
Owner: docs
Last verified: 2026-06-24
Layer: schema
Module: docs-system
Doc Type: reference

## 目的

定义这套知识系统对外暴露的 MCP surface，包括资源类型、工具集合和结果结构。

## 适合什么时候读

- 要实现 MCP server
- 想知道应该暴露哪些资源
- 想明确 AI 客户端可以依赖哪些工具

## 资源族

### 索引资源

- `kb://index`
- `kb://status/current`
- `kb://status/planned`
- `kb://status/historical`
- `kb://owners/<owner>`

### 区域资源

- `kb://areas/architecture`
- `kb://areas/platform`
- `kb://areas/chat`
- `kb://areas/role`
- `kb://areas/knowledge-base`
- `kb://areas/providers`
- `kb://areas/prompt-manager`

### 文档资源

- `kb://doc/<normalized-path>`
- `kb://doc/<normalized-path>#<anchor>`

### 概念资源

- `kb://concepts/<concept-name>`
- `kb://concepts/<concept-name>/neighbors`

## 工具集合

### 发现类工具

- `list_areas`
- `list_docs`
- `list_concepts`
- `list_owners`

### 读取类工具

- `read_doc`
- `read_section`
- `read_area_bundle`
- `read_concept_bundle`

### 搜索类工具

- `search_docs`
- `search_sections`
- `search_by_status`
- `search_by_owner`
- `search_by_code_anchor`

### 关系类工具

- `related_docs`
- `doc_links`
- `concept_neighbors`
- `code_anchor_neighbors`

## 标准结果结构

每个工具结果建议至少带这些字段：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `path` | string | 是 | 规范化 source path |
| `title` | string | 是 | 文档标题 |
| `heading` | string | 否 | section 标题 |
| `status` | string | 否 | current / planned / historical |
| `owner` | string | 否 | area owner |
| `area` | string | 否 | 逻辑 area |
| `excerpt` | string | 是 | 可读文本摘要或命中片段 |
| `score` | number | 否 | 搜索分数 |

## 访问策略

- 默认资源优先返回 current 文档。
- 历史文档在资源和工具结果里都必须显式标记。
- 二进制资源不暴露成文本资源。
- 搜索工具默认排除 `archive/`，除非显式请求。

## Related Docs

- `FULL_MCP_AND_INDEX_ARCHITECTURE.md`
- `INDEX_SCHEMA.md`
- `AI_READING_SCOPE.md`
