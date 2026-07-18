import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import type { CurrentTaskFrame } from "../types";

export type PlannerTaskPlanItemStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked";

export interface PlannerTaskPlanItem {
  id: string;
  title: string;
  status: PlannerTaskPlanItemStatus;
  completionCriteria?: string[];
}

export interface PlannerTaskPlanUpdate {
  items: PlannerTaskPlanItem[];
  activeItemId?: string;
  revisionReason?: string;
}

type CurrentTaskFrameWithPlan = CurrentTaskFrame & {
  taskPlan?: PlannerTaskPlanItem[];
  activePlanItemId?: string;
  planRevision?: number;
  planRevisionReason?: string;
};

const PLAN_ITEM_STATUSES = new Set<PlannerTaskPlanItemStatus>([
  "pending",
  "in_progress",
  "completed",
  "blocked",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const normalizeStrings = (value: unknown, limit = 8) =>
  Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        .map((item) => item.trim())
        .filter((item, index, items) => items.indexOf(item) === index)
        .slice(0, limit)
    : [];

const normalizePlanItem = (value: unknown): PlannerTaskPlanItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const status =
    typeof value.status === "string" &&
    PLAN_ITEM_STATUSES.has(value.status as PlannerTaskPlanItemStatus)
      ? (value.status as PlannerTaskPlanItemStatus)
      : null;

  if (!id || !title || !status) {
    return null;
  }

  const completionCriteria = normalizeStrings(value.completionCriteria);
  return {
    id,
    title,
    status,
    ...(completionCriteria.length > 0 ? { completionCriteria } : {}),
  };
};

export const parsePlannerTaskPlanUpdate = (
  rawDecision: Record<string, unknown> | undefined,
): PlannerTaskPlanUpdate | undefined => {
  const rawPlan = rawDecision?.plan;
  if (!isRecord(rawPlan) || !Array.isArray(rawPlan.items)) {
    return undefined;
  }

  const items = rawPlan.items
    .map(normalizePlanItem)
    .filter((item): item is PlannerTaskPlanItem => Boolean(item))
    .filter((item, index, allItems) => allItems.findIndex((other) => other.id === item.id) === index);

  if (items.length === 0) {
    return undefined;
  }

  const requestedActiveItemId =
    typeof rawPlan.activeItemId === "string" ? rawPlan.activeItemId.trim() : "";
  const requestedActive = requestedActiveItemId
    ? items.find(
        (item) =>
          item.id === requestedActiveItemId &&
          item.status !== "completed" &&
          item.status !== "blocked",
      )
    : undefined;
  const inferredActive =
    requestedActive ??
    items.find((item) => item.status === "in_progress") ??
    items.find((item) => item.status === "pending");

  const normalizedItems = items.map((item) => {
    if (!inferredActive) {
      return item.status === "in_progress" ? { ...item, status: "pending" as const } : item;
    }
    if (item.id === inferredActive.id) {
      return item.status === "pending" ? { ...item, status: "in_progress" as const } : item;
    }
    return item.status === "in_progress" ? { ...item, status: "pending" as const } : item;
  });

  const revisionReason =
    typeof rawPlan.revisionReason === "string" && rawPlan.revisionReason.trim()
      ? rawPlan.revisionReason.trim()
      : undefined;

  return {
    items: normalizedItems,
    ...(inferredActive ? { activeItemId: inferredActive.id } : {}),
    ...(revisionReason ? { revisionReason } : {}),
  };
};

const getPlanSnapshot = (frame: CurrentTaskFrame | undefined) => {
  const plannedFrame = frame as CurrentTaskFrameWithPlan | undefined;
  return plannedFrame?.taskPlan
    ? {
        items: plannedFrame.taskPlan,
        activeItemId: plannedFrame.activePlanItemId,
      }
    : undefined;
};

export const applyPlannerTaskPlan = (
  frame: CurrentTaskFrame | undefined,
  update: PlannerTaskPlanUpdate | undefined,
): CurrentTaskFrame | undefined => {
  if (!frame || !update) {
    return frame;
  }

  const plannedFrame = frame as CurrentTaskFrameWithPlan;
  const previousSnapshot = getPlanSnapshot(frame);
  const nextSnapshot = {
    items: update.items,
    activeItemId: update.activeItemId,
  };
  const changed = JSON.stringify(previousSnapshot) !== JSON.stringify(nextSnapshot);
  const activeItem = update.activeItemId
    ? update.items.find((item) => item.id === update.activeItemId)
    : undefined;
  const remainingWork = update.items
    .filter((item) => item.status === "pending" || item.status === "in_progress")
    .map((item) => item.title);
  const completedProgress = update.items
    .filter((item) => item.status === "completed")
    .map((item) => `Plan completed: ${item.title}`);
  const coveredProgress = [
    ...(frame.coveredProgress ?? []),
    ...completedProgress,
  ]
    .filter((item, index, items) => item && items.indexOf(item) === index)
    .slice(-40);

  return {
    ...frame,
    ...(activeItem
      ? { currentSubtask: activeItem.title }
      : update.items.every((item) => item.status === "completed")
        ? { currentSubtask: "Verify the completed plan against the full user goal and answer." }
        : {}),
    coveredProgress: coveredProgress.length > 0 ? coveredProgress : undefined,
    remainingWork: remainingWork.length > 0 ? remainingWork : undefined,
    taskPlan: update.items,
    activePlanItemId: update.activeItemId,
    planRevision: changed ? (plannedFrame.planRevision ?? 0) + 1 : plannedFrame.planRevision ?? 0,
    ...(update.revisionReason
      ? { planRevisionReason: update.revisionReason }
      : plannedFrame.planRevisionReason
        ? { planRevisionReason: plannedFrame.planRevisionReason }
        : {}),
  } as CurrentTaskFrame;
};

export const getPlannerTaskPlanDiagnostics = (frame: CurrentTaskFrame | undefined) => {
  const plannedFrame = frame as CurrentTaskFrameWithPlan | undefined;
  const items = plannedFrame?.taskPlan ?? [];
  return {
    planRevision: plannedFrame?.planRevision ?? 0,
    planItemCount: items.length,
    activePlanItemId: plannedFrame?.activePlanItemId ?? null,
    completedPlanItemCount: items.filter((item) => item.status === "completed").length,
    blockedPlanItemCount: items.filter((item) => item.status === "blocked").length,
  };
};

/**
 * Adds the task-plan contract without changing AgentNextAction itself.
 * The canonical action remains the only execution decision; `plan` is planner-owned
 * semantic state that is persisted inside currentTaskFrame.
 */
export const withPlannerTaskPlanContract = (
  messages: NormalizedChatMessage[],
): NormalizedChatMessage[] => {
  if (messages.length === 0) {
    return messages;
  }

  const planContract = [
    "TASK PLAN CONTRACT (applies to this Planner response):",
    "Before choosing nextAction, maintain a persistent semantic task plan for the full user goal.",
    "The plan is NOT a precomputed list of tool calls. Plan items describe semantic subgoals/outcomes; tools are selected later only to advance the active item.",
    "On the first planning turn, create the plan. On later turns, first evaluate the latest Evidence against the active plan item, mark completed work, then either continue that item, advance to the next item, or revise the plan when Evidence proves the old plan incomplete.",
    "Keep stable item ids across turns. Do not reset the plan just because a new tool result arrived.",
    "nextAction must directly advance the active plan item. Do not wander into unrelated discovery or documentation.",
    "Return the FULL current plan on every normal Planner response as one additional top-level field named plan. This is the only allowed extra top-level field beyond the canonical action fields.",
    'plan schema: {"items":[{"id":"P1","title":"semantic subgoal","status":"pending|in_progress|completed|blocked","completionCriteria":["observable completion condition"]}],"activeItemId":"P1","revisionReason":"optional concise reason"}',
    "Exactly one unfinished item should normally be in_progress. If all plan items are completed, verify the full user goal/completion criteria and choose answer; if something is still missing, revise the plan before choosing another tool.",
    "Runtime memory comes only from currentTaskFrame, accumulatedActionLedger, Evidence, and recent observations. There is NO implicit engineering-memory-file feature.",
    "Do NOT search for or open docs/ENGINEERING_MEMORY.md, ENGINEERING_MEMORY.md, MEMORY.md, memory notes, or similarly named files merely to remember prior work, recover a plan, or understand Agent state. Only inspect such a file when the user explicitly asks about that file or the file itself is directly part of the requested task.",
    "The earlier 'no extra fields' rule has exactly one exception: the top-level plan field defined above. The action type is still exactly one of answer/retrieve/use_tool/ask_user/error.",
  ].join("\n");

  const firstSystemIndex = messages.findIndex((message) => message.role === "system");
  if (firstSystemIndex < 0) {
    return [
      {
        role: "system",
        content: planContract,
        parts: [{ type: "text", text: planContract }],
      },
      ...messages,
    ];
  }

  return messages.map((message, index) => {
    if (index !== firstSystemIndex) {
      return message;
    }
    const content = `${message.content}\n\n${planContract}`;
    return {
      ...message,
      content,
      parts: [{ type: "text", text: content }],
    };
  });
};
