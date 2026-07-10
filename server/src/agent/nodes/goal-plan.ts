/**
 * 目标与计划：根据用户问题创建 Agent 目标和最小执行计划。
 */
import type { AgentGoal } from "../types";

export const createAgentGoal = (text: string): AgentGoal => ({
  id: crypto.randomUUID(),
  text,
  successCriteria: ["回答用户当前问题，并说明不确定性。"],
  constraints: ["复用当前项目已有 RAG、Harness、provider 和 trace 基建。"],
  riskLevel: "low",
});
