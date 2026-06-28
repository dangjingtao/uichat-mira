# 知识系统完整方案

Status: Current
Owner: docs
Last verified: 2026-06-25
Layer: wiki
Module: Docs
Feature: DocsSystem
Doc Type: design

## 单点真相范围

定义一套完整的知识系统方案，让当前 `docs/` 目录在不改变 markdown 作为唯一编写源的前提下，同时支持：

- 人类阅读
- AI 接入
- 索引检索
- 概念导航
- 图谱可视化

当前这套完整方案明确参考：

- [karpathy/442a6bf555914893e9891c11519de94f](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)

这意味着这套系统不是单纯的站点整理，而是把文档当成可长期积累的 markdown wiki / AI 可读知识层来建设。

## 适合什么时候读

- 想看最终目标态，而不是轻量试点
- 想知道这套知识系统完整应该长什么样
- 想评估后续该往哪些层继续建设

## 当前事实

- 文档真相源仍然是 `docs/` 下的 markdown 文件。
- 完整方案不会替代 markdown，只会在它外面增加阅读层、索引层和接入层。
- 整套设计是分层的，目的是让不同工具各取所需，而不是逼所有工具共享一个阅读前端。
- 后续最重要的增强方向之一，不再只是补目录，而是明确“模块归属 + 文档角色”这套元数据层，让 AI 不靠猜就能理解文档。

## 系统目标

理想状态下，这套系统要同时满足：

- 人能舒服地读
- AI 能稳定地读
- 活跃技术文档可以全文检索
- 概念和关系可以被看见
- 现状、计划、历史三类内容不会混读
- 所有结论都能追回原始文档
- AI 能天然区分“这是哪个模块、哪种文档”

## 完整分层

### 第一层：源语料层

这一层就是当前 markdown 文档本身，包括：

- 区域文档
- 接口参考文档
- 架构文档
- 历史归档文档
- 必要时保留的源码邻接文档

建议元数据：

- `Status`
- `Owner`
- `Last verified`
- 可选的 tags / concepts
- 后续建议增加 `Module` 与 `Doc Type`

### 第二层：结构化索引层

围绕 markdown 生成一个结构化索引，记录：

- 规范化路径
- 标题
- section 标题
- status
- owner
- module
- doc type
- tags
- 出链
- 入链
- 代码锚点

这一层的作用是：让导航、过滤和搜索不再只靠全文扫描。

### 第三层：检索层

对外提供多种读取方式：

- 读整篇文档
- 读某个 section
- 关键词搜索
- 按 status / owner / area 过滤搜索
- 活跃文档上的语义搜索

这一层主要服务 AI 工具，也能反哺人类检索体验。

### 第四层：概念与图谱层

把 markdown 语料投影成图结构，例如：

- 文档节点
- 概念节点
- 区域节点
- 代码锚点节点
- 文档之间的链接和依赖边

这一层不是给人写文档用的，而是给浏览、分析和探索关系用的。

### 第五层：接入界面层

同一套语料可以被多个前端读取：

- Obsidian / Logseq 供人浏览
- MCP 供 AI 客户端读取
- Neo4j Bloom 之类的图界面供关系探索

## 典型阅读模式

### 人类阅读模式

主入口：

- `docs/` 作为 Obsidian vault

主要能力：

- 文件树
- backlinks
- local graph
- 搜索

### AI 助手模式

主入口：

- MCP resources / tools

主要能力：

- topic bundle
- file read
- section read
- 过滤搜索
- 带 source path 的结果引用

### 研究探索模式

主入口：

- 图谱投影 + 搜索

主要能力：

- 概念邻域浏览
- 关联文档发现
- 在明确需要时回看历史材料

## 内容分类

建议把文档分成这些内容类：

- `current-contract`
- `reference`
- `feature-overview`
- `implementation-notes`
- `planned-design`
- `historical`
- `assets`

不同内容类在搜索、默认暴露面和 AI 上下文里应该有不同处理方式。

## 默认暴露策略

- 当前有效契约和参考文档始终是一等输入。
- 规划型文档可以被读到，但必须显式标记。
- 历史文档默认不进 AI 上下文。
- 二进制资源默认不参加文本检索。

## 推荐工具栈

### 人类可视化

- `Obsidian` 作为主阅读面
- `Logseq` 作为可选 graph-first 方案

### AI 接入

- MCP server 作为标准 AI 接口
- 仅在受信任的本地流程中允许直接文件系统读取

### 搜索与索引

- markdown 元数据索引
- 活跃文档全文检索
- 按需增加活跃文档语义索引

### 图谱可视化

- Obsidian local graph 负责轻量关系浏览
- Neo4j Bloom 之类图界面负责结构化关系探索

## 推进形态

虽然最终可以分阶段落地，但完整方案应始终坚持四个前提：

- 一个真相源语料层
- 多个读取界面
- 一套一致的暴露策略
- 明确区分现状、计划和历史

## Related Docs

- `VISUALIZATION_AND_AI_ACCESS.md`
- `AI_READING_SCOPE.md`
- `FULL_MCP_AND_INDEX_ARCHITECTURE.md`
- `GRAPH_VISUALIZATION_PLAN.md`
