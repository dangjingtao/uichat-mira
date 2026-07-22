/**
 * 上下文准备节点：收集线程消息、可用工具和策略允许的自动工具列表。
 */
import { reconcileCodeGraphHarnessCapability } from "@/harness/codegraph-capability";
import { listCapabilityDefinitions } from "@/harness/registry";
import { resolveActiveSkillContext } from "@/skills/registry.js";
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

  reconcileCodeGraphHarnessCapability();

  const toolDefinitions = listCapabilityDefinitions();
  const autoAllowedTools = toolDefinitions
    .filter((definition) => evaluateAgentToolPolicy(definition).type === "allow")
    .map((definition) => definition.id);
  const query = getLatestUserQuestion(state.messages) || state.goal.text;
  const activeSkill = resolveActiveSkillContext({
    question: query,
    messages: state.messages,
  });
  const matcherResult = await matchToolCandidatesByEmbedding({
    query,
    config: state.intentConfig,
  });

  const exposedToolIds = [...matcherResult.toolExposure.exposedToolIds];
  const exposedDefinitions = [...matcherResult.toolExposure.exposedDefinitions];
  if (activeSkill) {
    for (const toolId of activeSkill.primaryToolIds) {
      if (exposedToolIds.includes(toolId)) continue;
      const definition = toolDefinitions.find((candidate) => candidate.id === toolId);
      if (!definition) continue;
      if (evaluateAgentToolPolicy(definition).type === "deny") continue;
      exposedToolIds.push(toolId);
      exposedDefinitions.push(definition);
    }
  }

  // Skill semantics belong on its high-level business capability, not on Read
  // primitives. Planner still consumes one canonical toolExposure and there is
  // no second tool list or use_skill action.
  const activeSkillBusinessToolIds = new Set(
    activeSkill?.primaryToolIds.filter((toolId) => toolId.startsWith("office_")) ?? [],
  );
  const skillAwareDefinitions = activeSkill
    ? exposedDefinitions.map((definition) =>
        activeSkillBusinessToolIds.has(definition.id)
          ? {
              ...definition,
              description: [
                definition.description,
                `Active Skill: ${activeSkill.id} (${activeSkill.name}).`,
                ...activeSkill.instructions,
                "Skill completion criteria:",
                ...activeSkill.completionCriteria.map((criterion) => `- ${criterion}`),
              ].join("\n"),
            }
          : definition,
      )
    : exposedDefinitions;

  const toolExposure = toAgentToolExposureState(exposedToolIds, skillAwareDefinitions);
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
      exposedToolCount: toolExposure.exposedTools.length,
      exposedToolIds: toolExposure.exposedTools,
      activeSkillId: activeSkill?.id ?? null,
      activeSkillBusinessToolIds: [...activeSkillBusinessToolIds],
      codebaseExploreExposed: toolExposure.exposedTools.includes("codebase_explore"),
      currentTaskFrameWriter: "prepareContextNode reads the initialized task frame only",
    },
  });

  return {
    toolIntent,
    toolExposure,
  };
};
