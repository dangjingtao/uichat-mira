# Chat 总览

Status: Current
Owner: chat
Last verified: 2026-07-18
Layer: wiki
Module: Chat
Feature: Overview
Doc Type: overview
Canonical: true
Related:
  - ../uchat.md
  - ../uchat-internal-maintenance.md
  - ../maps/AREA_MAP_CHAT.md
  - ../harness/agentgraph-harness-protocol.md
  - ../development/agent-observability.md

## 单点真相范围

这页是 Chat 模块的目录入口。

它统一回答：

- chat 主线当前有哪些稳定阅读点
- 哪些是当前契约，哪些是实施清单、历史设计或规划
- `UChat`、tool integration、execution trace、Agent Runtime 各自应该从哪篇进入

## 推荐阅读顺序

1. `../uchat.md`
2. `../uchat-internal-maintenance.md`
3. `../harness/agentgraph-harness-protocol.md`
4. `../development/agent-observability.md`
5. `chat-system-practices.md`
6. `chat-tool-integration-research.md`
7. `chat-execution-trace-design.md`

## 当前入口

### 当前契约

- `../uchat.md`
- `../uchat-internal-maintenance.md`
- `chat-system-practices.md`

### Agent Runtime 当前合同

- `../harness/agentgraph-harness-protocol.md`
  - AgentRun、AgentGraph 门面、Pi Loop、LangGraph 兼容运行时和 Harness 的当前单点真相
  - 当前应用默认是 Pi Loop，不是 LangGraph-first
- `../development/agent-observability.md`
  - Pi Loop / LangGraph 共用的运行时 span、execution node 和 Phoenix 排查方法
- `agent-frontend-workspace-smoke-method.md`
  - 前台 workspace 绑定与真实 Agent smoke 方法

### Agent 历史与施工资料

以下页面用于理解演进或回看任务，不得覆盖当前合同：

- `agent-runtime-design.md`（已退役的历史设计输入）
- `agent-loop-v1.7-construction-plan.md`（施工期计划）
- `agent-swot-plan.md`
- `agent-phase-1-checklist.md`
- `agent-phase-2-checklist.md`
- `agent-phase-3-checklist.md`
- `agent-workspace-context-system.md`
- `agent-workspace-context-checklist.md`

评审和施工引用优先级：

```text
current-contract
  > current overview / runbook
  > implementation plan / task card
  > historical design
```

### Tool Integration

- `chat-tool-integration-research.md`
- `chat-tool-integration-poc.md`
- `chat-tool-integration-checklist.md`

### Execution Trace

- `chat-execution-trace-design.md`
- `chat-execution-trace-checklist.md`

### UI Assessment

- `uchat-agent-ui-assessment.md`

### UChat UI 规划

- `uchat-ui-slot-design.md`（筹划中；尚未批准实施）

### UChat 应用状态

- `uchat-application-state-lifecycle-design.md`（当前合同与实施记录）

### UChat Governance

- `uchat-governance/README.md`
- `uchat-governance/governance-assessment.md`
- `uchat-governance/boundary-contract.md`
- `uchat-governance/phase-1-plan.md`
- `uchat-governance/ambiguity-log.md`

## 当前 Agent 口径

在 Chat 文档里，以下术语必须分开使用：

- `AgentGraph`：稳定运行时门面和输入输出合同
- `Pi Loop`：当前应用默认编排器
- `LangGraph`：兼容与测试对照运行时
- `Harness`：工具暴露、Policy 边界、Invocation 与结果投影控制平面
- `AgentRun`：产品运行真相

不得再把 `AgentGraph` 直接解释成“当前应用一定由 LangGraph StateGraph 编排”。
