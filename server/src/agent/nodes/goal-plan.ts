/**
 * 目标与计划：根据用户问题创建 Agent 目标和最小执行计划。
 */
import type { AgentGoal, AgentPlan } from "../types";

export const createAgentGoal = (text: string): AgentGoal => ({
  id: crypto.randomUUID(),
  text,
  successCriteria: ["回答用户当前问题，并说明不确定性。"],
  constraints: ["复用当前项目已有 RAG、Harness、provider 和 trace 基建。"],
  riskLevel: "low",
});

// V1 only keeps a minimal static plan skeleton for trace and run metadata.
// It is not a completed TaskFrame implementation.
export const createAgentPlan = (goal: AgentGoal): AgentPlan => ({
  id: crypto.randomUUID(),
  goalId: goal.id,
  version: 1,
  steps: [
    {
      id: "plan",
      kind: "reason",
      title: "建立 Agent 执行计划",
      status: "pending",
      riskLevel: "low",
      requiresApproval: false,
    },
    {
      id: "retrieve",
      kind: "retrieve",
      title: "检索可用上下文",
      status: "pending",
      riskLevel: "low",
      requiresApproval: false,
    },
    {
      id: "generate",
      kind: "generate",
      title: "生成最终回答",
      status: "pending",
      riskLevel: "low",
      requiresApproval: false,
    },
    {
      id: "evaluate",
      kind: "reason",
      title: "检查回答是否满足目标",
      status: "pending",
      riskLevel: "low",
      requiresApproval: false,
    },
  ],
});
