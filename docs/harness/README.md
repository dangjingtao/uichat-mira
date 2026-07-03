# Harness 模块

Status: Current
Owner: runtime
Last verified: 2026-06-28
Layer: wiki
Module: Harness
Feature: Overview
Doc Type: overview
Canonical: true
Related:
  - harness-assessment-2026-06-28.md
  - harness-phase-1-implementation-checklist.md
  - harness-gap-review-checklist.md
  - sandbox-module.md
  - agentgraph-harness-protocol.md

## 单点真相范围

这页是当前 `Harness` 模块的入口。

它主要回答：

- Harness 负责什么
- 风控边界怎么理解
- 为什么沙箱比单纯加严审批更合适

## 推荐入口

1. `harness-assessment-2026-06-28.md`
2. `harness-phase-1-implementation-checklist.md`
3. `harness-gap-review-checklist.md`
4. `sandbox-module.md`
5. `agentgraph-harness-protocol.md`

## 当前结论

当前 Harness 的定位不是“全局审批机”，而是：

- 运行时控制平面
- 沙箱边界协调器
- 审批兜底层
- 执行观察与审计层
