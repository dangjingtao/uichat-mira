---
status: current
owner: chat
last_verified: 2026-07-30
layer: wiki
module: Chat
feature: Overview
doc_type: overview
canonical: true
related:
  - ../AGENT_CURRENT_TRUTH.md
  - ../uchat.md
  - ../uchat-internal-maintenance.md
  - ../harness/agentgraph-harness-protocol.md
  - ../development/agent-observability.md
---

# Chat 模块总览

> 这页是 Chat 与 Agent 产品界面的阅读入口，不重新定义 Agent Runtime。

## 推荐阅读顺序

1. [[AGENT_CURRENT_TRUTH]]：Agent 当前总真相；
2. [[harness/agentgraph-harness-protocol]]：Main Planner、Harness、Evidence 与 SubAgent 技术协议；
3. [[development/agent-observability]]：execution node 与开发诊断；
4. [[skill/README]]：Skill 与 SubAgent 执行边界；
5. [[uchat]]：UChat 当前合同；
6. [[uchat-internal-maintenance]]：UChat 内部维护边界；
7. `chat-system-practices.md`：Chat 工程实践。

## Agent 当前口径

以下术语必须分开：

- `AgentRun`：产品运行真相与持久化状态；
- `AgentGraph`：稳定运行时门面；
- `Pi Loop`：应用默认 Main Agent 编排器；
- `LangGraph`：显式兼容与测试对照运行时；
- `Main Planner`：用户 global goal、下一步与最终完成判断；
- `Harness`：concrete tool 的候选、边界、审批、执行、结果和审计控制平面；
- `Generic SubAgent`：由 `delegate_task` 启动的通用 task-local executor；
- `Skill-owned SubAgent`：由 primary Skill execution profile 启动的领域 executor；
- `Evidence`：真实工具、检索与 Child observation 的累计真相；
- `Generate`：只依据 frozen finalization packet 组织用户回答。

不得再说：

- AgentGraph 就等于 LangGraph；
- Agent 只有 Planner→Tool 一条路径；
- `delegate_task` 是普通 Harness Tool；
- SubAgent completed 就等于用户 global goal completed；
- Skill 仍然只能把说明书注入 Main Planner；
- 当前已经是开放式多 Agent 系统。

## 当前执行路径

### 普通回答或简单动作

```text
Main Planner
  -> answer / retrieve / concrete tool
  -> Evidence
  -> Main Planner
  -> Generate
```

### 通用工作包

```text
Main Planner
  -> delegate_task
  -> Generic SubAgent
  -> Evidence
  -> Main Planner acceptance
```

### 领域 Skill

```text
Skill match / continuation
  -> Skill-owned SubAgent or deterministic Skill Flow
  -> Evidence / Artifact / Requirement
  -> Parent governance
  -> Generate or ask_user
```

## UI 当前责任

Chat UI 负责：

- 发起和停止 AgentRun；
- 显示 execution nodes；
- 展示 Planner public reason；
- 展示 Main / SubAgent 工作状态；
- 展示 concrete tool、Evidence、approval 与 resume；
- 交付 waiting_user / waiting_approval / completed / failed；
- 持久化并恢复真实 trace。

Chat UI 不负责：

- 自己决定下一步；
- 用前端选中状态驱动工具执行；
- 重建 pending tool args；
- 在 Child 与 Parent 之间做隐藏路由；
- 把历史 approval node 覆盖成当前状态；
- 展示 hidden chain of thought。

## 观测节点

当前稳定语义包括：

- prepare context；
- next action planner；
- Generic SubAgent；
- Skill-owned SubAgent；
- tool call normalize；
- policy；
- approval / resume；
- retrieve / tool；
- Evidence；
- Generate；
- Finalize / error。

SubAgent 还会投影 task-local trace、working state、tool calls、requirements、artifacts 与 resumed approval state。

## 当前 Agent 已知偏差

Recoverable failure 恢复耗尽的 settled contract 是 guarded answer + completed。

截至 2026-07-30，`dev` Planner 当前直接返回 `error`，使 Graph failed 且跳过 Generate。

Chat UI 应显示真实失败状态，但文档和产品判断不能把该实现偏差写成新合同。详情见 [[AGENT_CURRENT_TRUTH]] 的“dev 已知实现漂移”章节。

## 历史与施工资料

以下页面只能用于理解演进或施工背景：

- `agent-runtime-design.md`：superseded LangGraph-first 设计；
- `agent-loop-v1.7-construction-plan.md`；
- `agent-swot-plan.md`；
- `agent-phase-1-checklist.md`；
- `agent-phase-2-checklist.md`；
- `agent-phase-3-checklist.md`；
- `agent-workspace-context-system.md`；
- `agent-workspace-context-checklist.md`；
- `chat-tool-integration-research.md`；
- `chat-tool-integration-poc.md`；
- `chat-tool-integration-checklist.md`。

引用优先级：

```text
AGENT_CURRENT_TRUTH
  > current technical contract / runbook
  > current module overview
  > implementation checklist / workboard
  > design / plan / historical
```

## UChat 与其他入口

- `../uchat.md`：UChat 组件与消息渲染合同；
- `../uchat-internal-maintenance.md`：内部维护；
- `chat-execution-trace-design.md`：trace 产品设计背景；
- `chat-execution-trace-checklist.md`：实施与验收记录；
- `uchat-governance/README.md`：UChat governance；
- `uchat-ui-slot-design.md`：规划材料，不是当前实现；
- `uchat-application-state-lifecycle-design.md`：应用状态合同与记录。