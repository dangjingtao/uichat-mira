/**
 * 上下文准备节点：收集线程消息、可用工具、策略允许的自动工具列表和按需 Skill 语义。
 */
import { reconcileCodeGraphHarnessCapability } from "@/harness/codegraph-capability";
import { listCapabilityDefinitions } from "@/harness/registry";
import { prepareSkillContext, type SkillContext } from "@/skills/context/index.js";
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

type SkillAwareTaskFrame = NonNullable<AgentNodeState["currentTaskFrame"]> & {
  skillContext?: SkillContext;
};

const withSkillContext = (
  frame: AgentNodeState["currentTaskFrame"],
  skillContext: SkillContext | undefined,
): AgentNodeState["currentTaskFrame"] => {
  if (!frame) return frame;
  const { skillContext: _previousSkillContext, ...baseFrame } = frame as SkillAwareTaskFrame;
  return {
    ...baseFrame,
    ...(skillContext ? { skillContext } : {}),
  } as SkillAwareTaskFrame;
};

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
    summary: "正在读取线程上下文、可用工具和任务 Skill",
  });

  reconcileCodeGraphHarnessCapability();

  const toolDefinitions = listCapabilityDefinitions();
  const autoAllowedTools = toolDefinitions
    .filter((definition) => evaluateAgentToolPolicy(definition).type === "allow")
    .map((definition) => definition.id);
  const query = getLatestUserQuestion(state.messages) || state.goal.text;
  const matcherResult = await matchToolCandidatesByEmbedding({
    query,
    config: state.intentConfig,
  });

  // SkillContext is semantic guidance only. It never registers tools and never
  // expands the canonical Planner-visible toolExposure produced by Harness.
  const skillContext = await prepareSkillContext({
    query,
    messages: state.messages,
  });
  const currentTaskFrame = withSkillContext(state.currentTaskFrame, skillContext);

  const toolExposure = toAgentToolExposureState(
    [...matcherResult.toolExposure.exposedToolIds],
    [...matcherResult.toolExposure.exposedDefinitions],
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
      exposedToolCount: toolExposure.exposedTools.length,
      exposedToolIds: toolExposure.exposedTools,
      activeSkillId: skillContext?.primary?.id ?? null,
      activeSkillVersion: skillContext?.primary?.version ?? null,
      skillMatchSource: skillContext?.match?.source ?? null,
      skillResourceCount: skillContext?.resources.length ?? 0,
      disclosedSkillResourceCount: skillContext?.disclosedResources.length ?? 0,
      skillToolExposureMutation: false,
      codebaseExploreExposed: toolExposure.exposedTools.includes("codebase_explore"),
      currentTaskFrameWriter:
        "prepareContextNode only attaches semantic skillContext; Planner remains the sole writer of goal/subtask/completion inference",
    },
  });

  return {
    toolIntent,
    toolExposure,
    currentTaskFrame,
  };
};
