# Skill Roadmap

Status: Current
Owner: docs / chat / runtime
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SkillRoadmap
Doc Type: roadmap
Canonical: true
Related:
  - README.md
  - skill-memory-poc.md
  - schema/skill-card.schema.md
  - catalog/README.md

## 单点真相范围

这页只定义 `docs/skill` 的阶段路线图。

它回答：

- 每个阶段要解决什么
- 每个阶段明确不解决什么
- 当前任务停在哪一层

它不回答：

- 具体 runtime 代码怎么写
- DB schema 细节怎么定
- AgentGraph / Harness / MCP 具体怎么改

## Phase 0

名称：docs-only foundation

目标：

- 统一 skill 命名规则
- 固定 skill card schema
- 整理第一批 catalog、eval 和边界文档
- 明确 thread-level memory POC 的写回和确认规则

不包含：

- runtime
- DB schema
- server / desktop / tauri / scripts 改动
- AgentGraph / Harness / MCP / ToolNode / Policy / Planner 改动

当前状态：

- 本次任务停留在这里

## Phase 1

名称：thread-level memory runtime spike

目标：

- 评估是否要把 `save_thread_memory` 的可见写回闭环落成最小实现
- 明确 thread-level memory 的对象归属、确认交互和读写协议

不包含：

- 用户级全局画像
- 自动长期学习
- topic / preference / decision 独立对象化

## Phase 2

名称：entry-level memory editing

目标：

- 评估是否把偏好和决策从整段文本里提升成可逐条编辑的对象或半结构化条目
- 补齐逐条编辑、逐条删除、条目级确认等交互

不包含：

- 跨线程全局记忆
- marketplace 化

## Phase 3

名称：structured memory expansion

目标：

- 评估是否拆出 `preference`、`decision`、`topic` 等独立结构
- 评估 trace、审计、回放和后续消费方式

不包含：

- 把 `SKILL` 直接等同于 MCP server
- 把记忆层直接扩成企业知识图谱平台

## Phase 4

名称：platform integration and productization

目标：

- 在前几阶段被证明有价值后，再讨论更完整的 runtime、产品入口和平台级接入方式
- 评估是否需要更广义的 skill registry、运营入口或生态包装

前提：

- Phase 1 到 Phase 3 的边界、对象和交互已经被验证

## 当前结论

`docs/skill` 当前只完成到 `Phase 0`。

任何 `Phase 1+` 内容都需要单独任务、单独评审，不能从这次 docs-only 文档整理自动推导为已批准实现。
