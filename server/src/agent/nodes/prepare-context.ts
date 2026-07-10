/**
 * 上下文准备节点：收集线程消息、可用工具和策略允许的自动工具列表。
 */
import { listCapabilityDefinitions } from "@/harness/registry";
import { evaluateAgentToolPolicy } from "../policy";
import { emitStepNode } from "../node-runtime";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";
import { matchToolCandidatesByEmbedding } from "../intent/embedding-capability-matcher";
import { getLatestUserQuestion } from "./shared";

const toAgentToolExposureState = (
  toolIntent: Awaited<ReturnType<typeof matchToolCandidatesByEmbedding>>,
) => ({
  exposedTools: toolIntent.toolExposure.exposedToolIds,
  toolMeta: toolIntent.toolExposure.exposedDefinitions.map((definition) => ({
    toolId: definition.id,
    title: definition.title,
    description: definition.description,
    inputSchema: definition.inputSchema,
    domain: definition.domain,
    source: definition.source,
    tags: definition.tags,
    capabilities: definition.capabilities,
  })),
});

export const prepareContextNode = async (
  state: AgentNodeState,
  emit?: EmitAgentExecutionNode,
): Promise<Partial<AgentNodeState>> => {
  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-prepare-context",
    nodeType: "reason",
    phase: "start",
    label: "准备上下文",
    summary: "正在读取线程上下文和可用工具",
  });

  const toolDefinitions = listCapabilityDefinitions();
  const autoAllowedTools = toolDefinitions
    .filter((definition) => evaluateAgentToolPolicy(definition).type === "allow")
    .map((definition) => definition.id);
  const query = getLatestUserQuestion(state.messages) || state.goal.text;
  const toolIntent = await matchToolCandidatesByEmbedding({
    query,
    config: state.intentConfig,
  });

  await emitStepNode(emit, {
    runId: state.runId,
    nodeId: "agent-prepare-context",
    nodeType: "reason",
    phase: "done",
    label: "准备上下文",
    summary: "已完成 Agent 上下文准备",
    details: {
      messageCount: state.messages.length,
      requestContextCount: state.requestContextMessages?.length ?? 0,
      autoAllowedTools,
      exposedToolCount: toolIntent.toolExposure.exposedToolIds.length,
      currentTaskFrameWriter: "prepareContextNode reads the initialized task frame only",
    },
  });

  return {
    toolIntent,
    toolExposure: toAgentToolExposureState(toolIntent),
  };
};
