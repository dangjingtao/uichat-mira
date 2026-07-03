# 索引结构

Status: Current
Owner: docs
Last verified: 2026-06-24
Layer: schema
Module: Docs
Feature: DocsSystem
Doc Type: reference

## 目的

定义这套 markdown 知识系统的结构化索引字段。

## 适合什么时候读

- 要实现元数据索引
- 想知道哪些字段应该支持搜索或过滤
- 想保持 document record 和 section record 结构一致

## 当前事实

- 索引层是从 markdown 派生出来的。
- 索引必须保留文件级和 section 级的可追溯性。
- section 记录是一级对象，不只是整篇文件的附属信息。

## 文档记录

每个 markdown 文件应生成一条 document record，字段如下：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `doc_id` | string | 是 | 稳定的规范化文档 id |
| `path` | string | 是 | 规范化相对路径 |
| `title` | string | 是 | 顶级标题，没有则退回文件名 |
| `status` | string | 否 | `current`、`planned`、`historical` |
| `owner` | string | 否 | 归属域 |
| `last_verified` | string | 否 | ISO 日期字符串 |
| `area` | string | 否 | architecture、role、platform、chat 等 |
| `tags` | string[] | 否 | 可选标签 |
| `summary` | string | 否 | 可选的派生摘要 |
| `outbound_links` | string[] | 是 | 出链到的本地文档 |
| `code_anchors` | string[] | 是 | 引用到的代码路径 |
| `headings` | string[] | 是 | 按顺序记录的 heading 列表 |
| `content_class` | string | 是 | contract、reference、feature、historical 等 |
| `updated_at` | string | 是 | 索引更新时间 |

### 字段优先级

索引里最重要的是这四个维度：

1. `layer`
2. `module`
3. `doc_type`
4. `status`

它们决定了：

- 这篇文档属于哪一层
- 这篇文档主要讲哪个模块
- 这篇文档是什么文档角色
- 这篇文档是不是当前真相

## Section 记录

每个 heading 分隔出的 section 应生成一条 section record：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `section_id` | string | 是 | 稳定的 section id |
| `doc_id` | string | 是 | 父文档 id |
| `path` | string | 是 | 父文档路径 |
| `heading` | string | 是 | section 标题 |
| `heading_level` | number | 是 | markdown heading 级别 |
| `anchor` | string | 是 | 规范化 anchor slug |
| `status` | string | 否 | 默认继承自文档 |
| `owner` | string | 否 | 默认继承自文档 |
| `area` | string | 否 | 继承或派生 |
| `content_class` | string | 是 | 与文档同一分类体系 |
| `text` | string | 是 | 纯文本 section 内容 |
| `outbound_links` | string[] | 是 | section 内引用的链接 |
| `code_anchors` | string[] | 是 | section 内引用的代码路径 |
| `token_estimate` | number | 否 | 近似 token 数 |
| `updated_at` | string | 是 | 索引更新时间 |

## 派生视图

建议至少从基础记录派生出这些视图：

- 按 area 聚合文档
- 按 status 聚合文档
- 按 area 聚合 section
- 按 owner 聚合 section
- code-anchor 到文档的映射
- 文档链接图

## 规范化规则

- 路径统一使用 repo-relative 的正斜杠路径。
- `status` 在索引里统一小写。
- 展示字段保留原始标题大小写。
- id 由规范化路径和 heading anchor 组合生成。
- `module` 采用 `WIKI_SYSTEM_SCHEMA.md` 中固定的主模块口径。
- 一篇文档如果跨多个主题，索引只保留一个主 `module`，其余交叉主题放进 `tags` 或 `related`。

## Related Docs

- `FULL_MCP_AND_INDEX_ARCHITECTURE.md`
- `AI_READING_SCOPE.md`
- `DIRECTORY_AND_CLASSIFICATION_RULES.md`
