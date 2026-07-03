# Context Builder 设计

Status: Draft
Owner: runtime
Last verified: 2026-06-29
Layer: design
Module: Tool
Feature: ContextBuilder
Doc Type: design
Related:
  - README.md
  - harness-runtime-design.md
  - harness-assessment-2026-06-28.md
  - project-map-design.md

## 单点真相范围

这页定义 Harness Step 2：Context Builder 最小版。

它只做：

- module
- doc
- code chunk

它不是 embedding 首发版。

## 构建目标

Context Builder 负责把 Project Map 里的基础索引变成任务上下文。

目标是：

- 动态构建最小但充分的上下文
- 避免把整个系统塞给模型
- 保留可解释性和可回溯性

## 推荐链路

```text
classify -> modules -> docs -> code -> compress
```

含义是：

- 先判定任务类型
- 再定位模块
- 再取文档
- 再取代码 chunk
- 最后压缩成可用上下文

## 预算原则

预算不要写死，但要可偏移。

默认关注面：

- 代码
- 文档
- 规范
- 历史
- 任务
- 日志

任务类型不同，预算应可偏移：

- 重构偏代码和符号
- 设计偏文档和规范
- bug 定位偏日志和历史

## 解释信息

每次构建都要尽量输出：

- freshness
- confidence

含义分别是：

- freshness
  - 新代码、新文档、新决策优先于旧知识
- confidence
  - 每段上下文为什么被选中

## 风险

- 只用 embedding 会错召回
- 只读代码会缺意图
- 只读文档会过时

## MVP

最小可行版本至少包含：

- module map
- doc index
- code index
- context builder
- confidence / freshness 输出

## 不要提前做的事

- 不要先上 embedding 再补项目地图
- 不要先做复杂 symbol graph 再没有 module map
- 不要把 rerank 当成基础设施起点
