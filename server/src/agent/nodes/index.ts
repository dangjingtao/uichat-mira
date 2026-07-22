/**
 * nodes 模块入口：聚合 Agent 图兼容节点与 Pi-loop 语义步骤。
 *
 * `*Node` 导出继续服务旧 LangGraph 和现有外部适配；
 * 语义命名导出供 Pi-loop 直接调用，避免把内部职责继续绑定为图节点。
 *
 * Skill Runtime 通过薄适配层包裹 prepare / planner / evidence 三个语义点，
 * 不改变 Planner -> Normalize -> Policy -> Tool -> Evidence -> Planner 主合同。
 */
export { createAgentGoal } from "./goal-plan";
export { getLatestUserQuestion } from "./shared";

export { prepareContextNode as basePrepareContextNode } from "./prepare-context";
export {
  skillAwarePrepareContextNode as prepareContextNode,
  skillAwareNextActionPlannerNode as nextActionPlannerNode,
  skillAwareEvidenceNode as evidenceNode,
  skillAwareEvidenceNode as appendPendingEvidence,
} from "@/skill/agent-integration";
export {
  approvalNode,
  approvalNode as pauseForApproval,
} from "./approval";
export {
  errorNode,
  errorNode as finishWithError,
} from "./error";
export { retrieveNode } from "./retrieve";
export { generateNode as baseGenerateNode } from "./generate";
export {
  harnessAwareGenerateNode as generateNode,
  buildHarnessGenerateContextText,
  createHarnessAwareGenerateNode,
} from "./harness-generate-context";
export {
  externalMcpAwareGenerateNode,
  buildExternalMcpGenerateContextText,
  createExternalMcpAwareGenerateNode,
} from "./external-mcp-generate-context";
export {
  evaluateNode,
  evaluateNode as finalizeRun,
} from "./evaluate";

export { nextActionPlannerNode as baseNextActionPlannerNode } from "./next-action-planner";
export { policyNode } from "./policy-node";
export {
  toolCallNormalizeNode,
  toolCallNormalizeNode as normalizeAndFreezeToolCall,
} from "./tool-call-normalize";
export { toolNode as baseToolNode } from "./tool-node";
export {
  harnessAwareToolNode as toolNode,
  attachHarnessLlmContentToExecution,
  type AgentToolExecutionWithLlmContent,
} from "./harness-tool-result";
export { evidenceNode as baseEvidenceNode } from "./evidence";

export {
  emitStepNode,
  getIterativeNodeId,
  getTraceAttemptMeta,
  type AgentGraphState,
  type AgentNodeState,
  type EmitAgentExecutionNode,
} from "../node-runtime";
