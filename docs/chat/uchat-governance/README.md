# UChat 治理专项

Status: Current
Owner: chat
Last verified: 2026-07-02
Layer: raw-source
Module: Chat
Feature: UChatGovernance
Doc Type: current-contract
Canonical: true
Related:
  - ../../uchat.md
  - ../../uchat-internal-maintenance.md
  - ../uchat-agent-ui-assessment.md
  - boundary-contract.md
  - phase-1-plan.md
  - governance-assessment.md
  - ambiguity-log.md

## 单点真相范围

这组文档专门用于长期治理 `uChat`，目标不是推翻现有实现，而是持续防止它因为功能扩张而变得不可维护。

本专项只聚焦四件事：

- 持续审查 `uChat` 当前代码结构和职责边界
- 记录哪些问题已经明确是缺陷，哪些只是高风险信号
- 记录哪些需求语义尚不清楚，禁止在未确认前“顺手改掉”
- 让未来 `Role / RAG / MCP / 自定义智能体 / 附件 / 文生图 / TTS` 接入时，有统一判断基线

## 当前结论

`uChat` 当前不是架构失效，而是已经进入“核心骨架仍然成立，但装配层和产品能力正在持续挤压边界”的阶段。

所以当前策略不是大重写，而是：

1. 保留 `core / ui / integration` 主边界
2. 严格审查 feature 需求往哪一层落
3. 在每轮接新能力前，先过一遍本专项文档

## 当前读法

1. `governance-assessment.md`
   第一轮代码现状评估、可维护性风险和结构缺陷
2. `boundary-contract.md`
   `core / ui / integration` 的硬边界，以及 capability / context / execution / media 分类基线
3. `phase-1-plan.md`
   短期一期治理目标、完成后的前后差别、明确不在一期解决的问题
4. `ambiguity-log.md`
   当前不清楚、不能擅自改动的需求语义与行为边界

## 当前非目标

本专项当前不做：

- 不立即拆分现有所有大文件
- 不为了“看起来优雅”而重写主链路
- 不因为看到 metadata/flags 多就立刻抽象一整套超前框架
- 不把所有聊天相关能力都硬塞进 `uChat core`

## 治理原则

### 1. 先判断是产品扩张，还是实现失控

不是所有复杂度上升都等于代码坏了。

需要先分清：

- 这是新能力自然带来的复杂度
- 还是职责放错层导致的复杂度

### 2. 不清楚的行为先记账，不瞎改

如果当前某个行为看起来别扭，但它可能是产品有意为之，就先进入 `ambiguity-log.md`，不要直接修。

### 3. 优先限制新债，而不是先追求旧债清零

当前更重要的是防止：

- `uChat core` 继续理解过多业务概念
- `ui` 继续承接 feature 规则
- integration 层继续长成“全知全能巨石”

### 4. 每次接新能力都要过能力矩阵

尤其是这些即将进入聊天的能力：

- 自定义智能体
- RAG
- Role
- MCP
- 当前 Agent
- 附件
- 文生图
- TTS

要持续判断它们是：

- 线程上下文能力
- 输入输出媒体能力
- 执行能力
- UI 展示能力

不要混写。
