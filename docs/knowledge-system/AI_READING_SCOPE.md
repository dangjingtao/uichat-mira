# AI 阅读范围

Status: Current
Owner: docs
Last verified: 2026-06-24
Layer: schema
Module: Docs
Feature: DocsSystem
Doc Type: current-contract

## 目的

定义这套文档知识库在默认情况下应该被 AI 读取哪些内容，哪些内容只在明确请求时才纳入上下文。

## 适合什么时候读

- 想把这套文档接给另一个 AI 工具
- 想避免历史材料被默认喂进去
- 想确定默认上下文集合应该覆盖哪些目录和文件

## 默认纳入集合

这些路径建议作为 AI 的默认输入：

- `README.md`
- `architecture/`
- `platform/`
- `developments/`
- `role/`
- `uchat.md`
- `uchat-internal-maintenance.md`
- `knowledge-base/`
- `provider/README.md`
- `maps/`
- `concepts/`

如果 AI 任务和文档体系本身有关，再额外纳入：

- `knowledge-system/DOCUMENTATION_STANDARDS.md`
- `knowledge-system/WIKI_SYSTEM_SCHEMA.md`
- `knowledge-system/DIRECTORY_AND_CLASSIFICATION_RULES.md`
- `knowledge-system/INDEX_SCHEMA.md`
- `knowledge-system/OPERATING_MODEL.md`
- `knowledge-system/VISUALIZATION_AND_AI_ACCESS.md`

## 默认排除集合

这些路径和文件默认不应进入 AI 上下文，除非显式请求：

- `archive/`
- `CHANGELOG.md`
- `developments/defect-log.md`
- `developments/product-roadmap-priorities.md`
- `tooling-runtime/tools-ecosystem-research.md`
- `assets/`

## 为什么这样划分

- 活跃契约和架构文档信号最高。
- 归档和 roadmap 很容易被误读成现状。
- 图片和资源目录会给文本型 AI 增加噪音。
- changelog 和 defect log 有价值，但更适合作为按需补充材料。

## 推荐模式

### 窄范围模式

适合实现问题和局部改动：

- `README.md`
- `architecture/`
- 一个具体功能域，例如 `role/` 或 `uchat.md`

### 标准模式

适合大多数助手问答与实现支持：

- 全部默认纳入集合

### 历史回看模式

适合排查旧设计、历史决策和行为演变：

- 默认纳入集合
- 再按需加 `archive/`、`developments/defect-log.md`、`CHANGELOG.md`

## 默认读取顺序

一般建议先读：

1. `README.md`
2. `WIKI_SYSTEM_SCHEMA.md`
3. `DOCUMENTATION_STANDARDS.md`
4. `DIRECTORY_AND_CLASSIFICATION_RULES.md`
5. `AI_READING_SCOPE.md`
6. 具体 area 文档

## Related Docs

- `VISUALIZATION_AND_AI_ACCESS.md`
- `DOCUMENTATION_STANDARDS.md`
