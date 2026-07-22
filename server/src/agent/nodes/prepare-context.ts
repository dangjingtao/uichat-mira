/**
 * 上下文准备节点：收集线程消息、可用工具和策略允许的自动工具列表。
 */
import { reconcileCodeGraphHarnessCapability } from "@/harness/codegraph-capability";
import { listCapabilityDefinitions } from "@/harness/registry";
import { evaluateAgentToolPolicy } from "../policy";
import { emitStepNode } from "../node-runtime";
import type { AgentNodeState, EmitAgentExecutionNode } from "../node-runtime";
import { matchToolCandidatesByEmbedding } from "../intent/embedding-capability-matcher";
import { getLatestUserQuestion } from "./shared";

const toAgentToolExposureState = (
  exposedToolIds: string[],
  exposedDefinitions: Array<
    Awaited<ReturnType<typeof matchToolCandidatesByEmbedding>>["toolExposure"]["exposedDefinitions"][number]
  >,
) => ({
  exposedTools: exposedToolIds,
  toolMeta: exposedDefinitions.map((definition) => ({
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

  // Dynamic microapp capabilities must be reconciled against the latest owner
  // configuration before the registry snapshot for this Agent run is frozen.
  // This keeps Planner exposure truthful without introducing a selector or
  // bypassing the normal Harness registry/exposure path.
  reconcileCodeGraphHarnessCapability();

  const toolDefinitions = listCapabilityDefinitions();
  const autoAllowedTools = toolDefinitions
    .filter((definition) => evaluateAgentToolPolicy(definition).type === "allow")
    .map((definition) => definition.id);
  const query = getLatestUserQuestion(state.messages) || state.goal.text;
  const matcherResult = await matchToolCandidatesByEmbedding({
    query,
    config: state.intentConfig,
    allowedToolIds: state.toolExposureAllowlist,
  });
  const toolExposure = toAgentToolExposureState(
    matcherResult.toolExposure.exposedToolIds,
    matcherResult.toolExposure.exposedDefinitions,
  );
  const toolIntent = matcherResult;

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
      runtimeToolConstraint: state.toolExposureAllowlist ?? null,
      exposedToolCount: toolExposure.exposedTools.length,
      exposedToolIds: toolExposure.exposedTools,
      codebaseExploreExposed: toolExposure.exposedTools.includes("codebase_explore"),
      currentTaskFrameWriter: "prepareContextNode reads the initialized task frame only",
    },
  });

  return {
    toolIntent,
    toolExposure,
  };
};
