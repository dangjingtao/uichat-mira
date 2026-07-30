---
status: archived
owner: docs / agent-runtime
last_verified: 2026-07-30
layer: historical
module: Agent
feature: AgentArchive
doc_type: archive
canonical: true
related:
  - ../../AGENT_CURRENT_TRUTH.md
  - ../../harness/agentgraph-harness-protocol.md
  - ../../skill/README.md
  - ../../skill/pi-skill-agent-execution.md
  - ../../project-control/phase-conclusions/agent-phase-1-2-archive-decision.md
---

# Agent 历史归档

> 这里保存 UIChat Mira Agent 从早期 LangGraph-first、三阶段建设、v1.7 施工，到 forked Skill Agent Pilot 的演进资料。它们用于解释历史，不定义当前运行时。

## 当前真相入口

1. [[AGENT_CURRENT_TRUTH]]：Agent 当前总真相；
2. [[harness/agentgraph-harness-protocol]]：AgentGraph、Harness、Evidence、Approval 与委派技术合同；
3. [[skill/README]]：Skill 当前合同；
4. [[skill/pi-skill-agent-execution]]：SubAgent 当前参考；
5. [[development/agent-observability]]：当前观测与诊断。

## 本次归档范围

### 早期 Agent 设计与路线

- `chat/agent-runtime-design.md`：LangGraph-first 时代的运行时设计输入；
- `chat/agent-swot-plan.md`：Agent Runtime 建设前的 SWOT 与路线评估；
- `chat/agent-loop-v1.7-construction-plan.md`：v1.7 Planner-Executor 施工总文件；
- `architecture/chat-agent-fast-review-2026-06-27.md`：2026-06-27 快速架构审查；
- `architecture/multi-agent-execution-truth.md`：被 `AGENT_CURRENT_TRUTH.md` 取代的旧“多 Agent 真相”。

### 阶段建设与评审

- `chat/agent-phase-1-checklist.md`：Phase 1，归档结论为 `ARCHIVED_DONE`；
- `chat/agent-phase-2-checklist.md`：Phase 2，归档结论为 `ARCHIVED_PARTIAL_SUPERSEDED`；
- `chat/agent-phase-3-checklist.md`：旧 Phase 3 平台化路线，已被 Agent V1.5 稳定化主线取代；
- `chat/agent-phase-1-global-review.md`：Phase 1 全局评审结论；
- `chat/uchat-agent-ui-assessment.md`：2026-07-02 的 UChat Agent UI 阶段评估。

### Workspace 与 Skill Pilot

- `chat/agent-workspace-context-system.md`：早期 Project Map / Context Builder 设计；
- `chat/agent-workspace-context-checklist.md`：对应旧实施清单；
- `skill/pi-skill-agent-pilot-status.md`：forked Skill Agent Pilot 状态快照；
- `tooling-runtime/agent-runtime-t29-t33-ledger.md`：T29–T33 施工台账。

## 为什么归档

这些文档至少满足一项：

- 已经有新的 current-contract / current-snapshot 取代；
- 阶段工作已经结束或被后续路线吸收；
- 仍保留 `Current`、`Canonical`、`Planned` 或 `Active Pilot` 会误导当前施工；
- 内容只剩演进、事故、设计取舍或验收背景价值。

## 兼容入口

原路径保留轻量退役页，防止历史链接直接失效。原路径不会保留旧正文，也不会继续拥有 Current / Canonical 解释权。

## 不在本次移动范围

- `docs/project-control/tasks/`：任务卡仍作为施工证据保留；
- `docs/project-control/reviews/`：评审证据保留；
- `docs/project-control/testEvidence/`：真实测试证据保留；
- 当前 Agent、Harness、Skill、Observability 合同与 runbook；
- 当前仍活跃的缺陷与恢复记录。

这些页面由文档生命周期分类器放入“施工与验证”或“历史归档”，不再和当前产品真相并列。
