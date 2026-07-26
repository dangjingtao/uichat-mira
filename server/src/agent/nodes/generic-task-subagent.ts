import type { SkillContext } from "@/skills/context/types.js";
import {
  createGenericTaskSkillContext,
  GENERIC_TASK_DELEGATE_TOOL_ID,
  parseGenericTaskDelegationArgs,
} from "../delegation/contract.js";
import {
  emitStepNode,
  type AgentNodeState,
  type EmitAgentExecutionNode,
} from "../node-runtime.js";
import type { AgentObservation, AgentToolCallRequest } from "../types.js";
import { forkedSkillAgentNode } from "./forked-skill-agent.js";

type SkillAwareTaskFrame = NonNullable<AgentNodeState["currentTaskFrame"]> & {
  skillContext?: SkillContext;
};

type DelegatedPreview = {
  status?: string;
  requirements: Record<string, unknown>[];
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const readDelegatedPreview = (
  observation: AgentObservation | undefined,
): DelegatedPreview => {
  const data = asRecord(observation?.summary?.data);
  const preview = asRecord(data?.preview);
  return {
    status: typeof preview?.status === "string" ? preview.status : undefined,
    requirements: Array.isArray(preview?.requirements)
      ? preview.requirements
          .map((item) => asRecord(item))
          .filter((item): item is Record<string, unknown> => Boolean(item))
      : [],
  };
};

const buildNeedsInputQuestion = (requirements: Record<string, unknown>[]) => {
  const questions = requirements
    .filter((requirement) => requirement.kind === "user_input")
    .map((requirement) => {
      const userPrompt =
        typeof requirement.userPrompt === "string"
          ? requirement.userPrompt.trim()
          : "";
      const description =
        typeof requirement.description === "string"
          ? requirement.description.trim()
          : "";
      return userPrompt || description;
    })
    .filter(Boolean)
    .slice(0, 3);

  return questions.length > 0
    ? questions.join("\n")
    : "还需要一项必要信息才能继续完成这个任务。请补充缺失的信息。";
};

const createLocalTaskFrame = (input: {
  state: AgentNodeState;
  skillContext: SkillContext;
  goal: string;
  acceptanceCriteria: string[];
}): SkillAwareTaskFrame => ({
  ...(input.state.currentTaskFrame ?? {
    globalGoal: input.state.goal.text,
    currentGoal: input.goal,
    confirmedObjects: [],
    completionCriteria: input.acceptanceCriteria,
  }),
  skillContext: input.skillContext,
});

const createSchemaReplanPatch = (input: {
  state: AgentNodeState;
  error: string;
  invalidAction: Extract<
    NonNullable<AgentNodeState["nextAction"]>,
    { type: "use_tool" }
  >;
}): Partial<AgentNodeState> => ({
  nextAction: undefined,
  schemaReplanDiagnostics: {
    schemaError: input.error,
    toolId: GENERIC_TASK_DELEGATE_TOOL_ID,
    invalidAction: input.invalidAction,
    attemptCount: (input.state.schemaReplanDiagnostics?.attemptCount ?? 0) + 1,
  },
});

export type ForkedTaskRunner = typeof forkedSkillAgentNode;

export const createGenericTaskSubAgentNode = (
  runForkedTask: ForkedTaskRunner = forkedSkillAgentNode,
) =>
  async (
    state: AgentNodeState,
    emit?: EmitAgentExecutionNode,
  ): Promise<Partial<AgentNodeState>> => {
    const action = state.nextAction;
    if (
      action?.type !== "use_tool" ||
      action.toolId !== GENERIC_TASK_DELEGATE_TOOL_ID
    ) {
      return {
        errorMessage:
          "generic task subAgent node requires a delegate_task planner action.",
        errorSourceNodeId: "agent-generic-task-subagent",
      };
    }

    const parsed = parseGenericTaskDelegationArgs(action.args);
    if (!parsed.ok) {
      return createSchemaReplanPatch({
        state,
        error: parsed.error,
        invalidAction: action,
      });
    }

    const actualExposedHarnessToolIds = state.toolExposure?.exposedTools ?? [];
    const skillContext = createGenericTaskSkillContext({
      task: parsed.task,
      exposedHarnessToolIds: actualExposedHarnessToolIds,
    });
    const localState: AgentNodeState = {
      ...state,
      currentTaskFrame: createLocalTaskFrame({
        state,
        skillContext,
        goal: parsed.task.goal,
        acceptanceCriteria: parsed.task.acceptanceCriteria,
      }),
    };

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-generic-task-subagent",
      nodeType: "reason",
      phase: "start",
      label: "任务 subAgent",
      summary: `正在委派任务：${parsed.task.goal}`,
      details: {
        delegatedGoal: parsed.task.goal,
        acceptanceCriteriaCount: parsed.task.acceptanceCriteria.length,
        exposedHarnessToolIds: actualExposedHarnessToolIds,
        recursiveDelegationExposed: actualExposedHarnessToolIds.includes(
          GENERIC_TASK_DELEGATE_TOOL_ID,
        ),
      },
    });

    const delegated = await runForkedTask(localState, emit);
    const observation = delegated.pendingEvidenceObservation;
    if (!observation) {
      return {
        errorMessage:
          "generic task subAgent returned without a structured observation.",
        errorSourceNodeId: "agent-generic-task-subagent",
      };
    }

    const preview = readDelegatedPreview(observation);
    let boundaryPatch: Partial<AgentNodeState> = {};

    if (!delegated.pendingApproval && preview.status === "needs_input") {
      boundaryPatch = {
        nextAction: {
          type: "ask_user",
          question: buildNeedsInputQuestion(preview.requirements),
          reason:
            "The delegated task reached a structured needs_input boundary; Parent must collect the missing information before continuing.",
        },
      };
    } else if (observation.status === "blocked") {
      const errorMessage =
        observation.errorMessage ??
        "generic task subAgent reported a terminal execution failure.";
      boundaryPatch = {
        errorMessage,
        errorSourceNodeId: "agent-generic-task-subagent",
        terminalReason: "generic_task_subagent_terminal_failure",
      };
    }

    await emitStepNode(emit, {
      runId: state.runId,
      nodeId: "agent-generic-task-subagent",
      nodeType: observation.status === "blocked" ? "error" : "reason",
      phase: observation.status === "blocked" ? "error" : "done",
      label: "任务 subAgent",
      summary: delegated.pendingApproval
        ? `任务 subAgent 等待审批：${delegated.pendingApproval.toolId}`
        : `任务 subAgent 已返回：${preview.status ?? observation.status}`,
      details: {
        delegatedGoal: parsed.task.goal,
        acceptanceCriteriaCount: parsed.task.acceptanceCriteria.length,
        status: preview.status ?? observation.status,
        approvalPending: Boolean(delegated.pendingApproval),
        toolCalls:
          asRecord(asRecord(observation.summary?.data)?.preview)?.trace &&
          Array.isArray(
            asRecord(
              asRecord(asRecord(observation.summary?.data)?.preview)?.trace,
            )?.toolCalls,
          )
            ? asRecord(
                asRecord(asRecord(observation.summary?.data)?.preview)?.trace,
              )?.toolCalls
            : [],
      },
    });

    return {
      ...delegated,
      ...boundaryPatch,
    };
  };

export const genericTaskSubAgentNode = createGenericTaskSubAgentNode();

export const isGenericTaskApprovalToolCall = (
  pendingToolCall: AgentToolCallRequest | undefined,
) => {
  if (!pendingToolCall || !("origin" in pendingToolCall)) return false;
  if (pendingToolCall.origin !== "skill_agent") return false;
  if (!("skillId" in pendingToolCall)) return false;
  return pendingToolCall.skillId === "mira.generic-task";
};
