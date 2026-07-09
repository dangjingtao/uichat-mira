---
status: current
owner: project-owner
last_verified: 2026-07-10
layer: project-control
module: ProjectControl
feature: MicroAppRegistryDebt
doc_type: decision
canonical: true
related:
  - docs/developments/defect-log.md
  - docs/project-control/project-control-ledger.md
  - server/src/db/repositories/micro-apps.repository.ts
  - server/src/routes/integrations/index.ts
---

# TD-T016-01 MicroAPP Definition Reconcile Gap

## Decision

接受一项仍未彻底消除的技术债：`micro_app_definitions` 当前依赖“按已知 seed 类型做初始化回填”来兼容旧记录，但没有独立版本化迁移链来保证未来字段演进时旧数据一定被完整修复。

## Reason

`CodeGraph Studio` 接入后暴露出一个已存在但之前不明显的问题：

- 前端仍通过同一个接口 `/integrations/micro-apps?type=knowledge_query` 读取知识库微应用卡片
- 旧 `knowledge_query` 记录可能缺少 `supportedAccessPoints`、`bindingSchema`、`runtimeKey`
- 列表接口会按 `supportedAccessPoints.includes("wecom.smart_robot")` 过滤
- 结果是旧记录不会报错，但会从设置页列表里消失

本轮已经补上最小修复：

- `microAppsRepository.initialize()` 会对已知 seed 类型执行回填
- 旧 `knowledge_query` 会补回访问点、绑定 schema、runtime key 和默认描述

但这仍然只是“已知类型 + 已知字段”的修复，不是完整迁移机制。后续如果继续给微应用定义增加字段，仍可能出现：

- 旧库记录结构合法但语义不完整
- 后端过滤或前端展示条件悄悄失效
- 页面缺卡片，但接口层没有显式错误

## Affected Areas

- `Settings / Micro Apps` 列表页
- `knowledge_query` 既有微应用定义
- 后续新增的微应用定义字段演进
- `micro_app_definitions` 初始化与持久化兼容策略

## Rejected Alternatives

- 不登记技术债，只保留聊天解释
- 把这次局部回填误写成“微应用定义迁移问题已彻底解决”
- 把问题表述成“前端协议分叉”，掩盖真实层级

## Follow-up

- 后续如继续扩展微应用定义字段，应评估是否把 `micro_app_definitions` 升级为显式 schema migration
- 至少需要一个面向旧库样本的回归集合，覆盖：
  - 缺访问点
  - 缺 runtime key
  - 缺 binding schema
  - 新增字段未回填
- 在这项债务关闭前，不要假设“列表接口不报错”就等于“微应用定义可见且完整”
