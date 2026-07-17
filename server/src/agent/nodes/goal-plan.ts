/**
 * 目标与计划：根据用户问题创建 Agent 目标和最小执行计划。
 */
import type { AgentGoal } from "../types";

const normalizeGoalText = (text: string) => text.trim() || "Complete the user's request.";

export const createAgentGoal = (text: string): AgentGoal => {
  const goalText = normalizeGoalText(text);

  return {
    id: crypto.randomUUID(),
    text: goalText,
    successCriteria: [
      `Complete every explicit requirement in the user's request: ${goalText}`,
      "Only finish when all explicit requirements are complete, or when continuation is impossible and the unfinished work plus blocking reason are reported.",
    ],
    constraints: [
      "Reuse the current project RAG, Harness, provider, and trace infrastructure.",
      "Keep MCP tool contracts and frontend integration contracts unchanged.",
    ],
    riskLevel: "low",
  };
};
