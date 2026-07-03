# Tool / MCP 接入聊天清单

Layer: raw-source
Module: Role
Feature: ToolIntegration
Doc Type: checklist

Status: Planned
Owner: chat / tool / mcp / runtime
Last verified: 2026-06-27

## 单点真相范围

这份清单只跟踪一件事：

- 批量工具 / MCP 能力如何安全、可控地接入聊天

它不覆盖：

- Role CRUD
- RAG 检索实现
- 单个工具的 provider 适配细节

## 设计目标

- 前端只展示“当前可用能力”，不直接绑定某个 provider
- 后端先做 capability discovery，再汇总成统一 tool surface
- 聊天层只认一个 `tool registry`
- timeline 继续复用同一套 execution trace，不再分新 UI
- 内置工具和 MCP 分开管理：内置工具用一个 `Agent` 总开关，MCP 需要显式配置和选择

## 核心分层

### 1. capability discovery

职责：

- 探测当前可用的工具 / MCP / 外部能力
- 判断 key、权限、连通性、运行时状态
- 输出可被 planner 消费的能力清单
- 内置工具默认属于基础能力集
- MCP 只包含用户显式启用的连接项

验收：

- 能区分“已可用 / 未配置 / 不可达 / 权限不足”
- 不把所有能力直接暴露给模型

### 2. tool planner

职责：

- 根据当前输入、线程上下文、Role、Summary、RAG 状态筛选工具
- 对工具做分组、裁剪和优先级排序
- 控制每轮最终暴露给模型的工具数量

验收：

- 同一轮不会把全量工具 schema 灌给模型
- planner 输出的是候选集，不是最终执行结果

### 3. tool executor

职责：

- 只接收 planner 输出的候选工具
- 真正执行 tool / MCP 调用
- 产出统一 execution trace

验收：

- 执行层不直接读全量 registry
- 工具失败不会打断 assistant 正文流

### 4. execution trace

职责：

- 统一展示 tool / MCP / RAG / request-only context
- 只保留简化后的用户可读轨迹
- 不把内部 planner 细节全部摊开

验收：

- 普通聊天、RAG、tool、MCP 共用同一条 timeline
- 前端不再新增独立工具卡体系

## 能力分流

### 内置工具

- 默认随 `Agent` 能力一起点亮
- 前端只需要一个总开关，不要求逐个配置
- planner 可以在本轮按需裁剪，但不需要用户逐个勾选

### MCP

- 必须由用户显式配置
- 前端要明确展示已启用的 MCP 列表
- 每个 MCP 应保留状态、权限和来源信息
- planner 只能使用当前启用的 MCP

## 必做清单

- [ ] 做 capability discovery
  验收：能列出当前可用工具 / MCP 及其可用性状态

- [ ] 给能力加 namespace 和基础分组
  验收：例如 `search` / `memory` / `mcp.xxx`

- [ ] 做 tool planner
  验收：能按输入和线程上下文筛掉无关能力

- [ ] 控制每轮暴露的候选工具数量
  验收：不会把全量 registry 直接交给模型

- [ ] 下发工具裁剪摘要而不是完整 schema
  验收：schema 进入模型前已经过压缩

- [ ] tool executor 只消费 planner 输出
  验收：执行层不反向依赖全量能力表

- [ ] 统一 tool / MCP execution trace
  验收：工具和 MCP 走同一条 timeline

- [ ] 前端只展示简化结果
  验收：只保留 discover / plan / execute 的可读轨迹

- [ ] 给失败态做降级
  验收：工具失败不打断 assistant 正文流

- [ ] 补端到端手测
  验收：普通聊天、RAG、search、MCP 共用同一条 trace

## 风险提醒

- [ ] 工具太多时，模型选择空间过大，调用错误率会升高
- [ ] 未做裁剪就把全量 schema 灌给模型，会挤占对话上下文
- [ ] MCP 和本地工具混在一起不分组，会让 planner 难以稳定决策
- [ ] 前端如果为每种能力单独造 UI，后续会继续分裂

## 下一阶段

- [ ] 先做统一 capability discovery
- [ ] 再做 tool planner 的最小闭环
- [ ] 最后把 tool / MCP 接到统一 execution trace
