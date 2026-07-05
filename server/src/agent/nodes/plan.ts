/**
 * 计划节点（V1 占位）：生成最小化执行计划并输出 trace。
 */
import { emitStepNode } from "../node-runtime";
import { toPlanNodeDetails } from "../trace";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";

export const planNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  // planNode is still a placeholder trace node in V1. It does not rewrite the
  // run plan or produce a completed TaskFrame structure.
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-plan",
    nodeType: "plan",
    phase: "start",
    label: "执行计划",
    summary: "正在生成最小 Agent 计划",
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-plan",
    nodeType: "plan",
    phase: "done",
    label: "执行计划",
    summary: "已生成最小 Agent 计划",
    details: toPlanNodeDetails(state.plan.steps),
  });

  return {};
};
