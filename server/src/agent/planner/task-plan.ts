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

export interface PlannerTaskPlanPatch {
  addItems?: PlannerTaskPlanItem[];
  updates?: Array<{
    id: string;
    status: PlannerTaskPlanItemStatus;
  }>;
  activeItemId?: string;
  revisionReason?: string;
}

type CurrentTaskFrameWithPlan = CurrentTaskFrame & {
  planList?: PlannerTaskPlanItem[];
  activePlanItemId?: string;
  planRevision?: number;
  planRevisionReason?: string;
  // Temporary compatibility for task frames produced by the previous dev implementation.
  taskPlan?: PlannerTaskPlanItem[];
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

const normalizeStatus = (value: unknown): PlannerTaskPlanItemStatus | null =>
  typeof value === "string" && PLAN_ITEM_STATUSES.has(value as PlannerTaskPlanItemStatus)
    ? (value as PlannerTaskPlanItemStatus)
    : null;

const normalizeNewPlanItem = (value: unknown): PlannerTaskPlanItem | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = typeof value.id === "string" ? value.id.trim() : "";
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const status = normalizeStatus(value.status) ?? "pending";
  if (!id || !title) {
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

export const parsePlannerTaskPlanPatch = (
  rawDecision: Record<string, unknown> | undefined,
): PlannerTaskPlanPatch | undefined => {
  const rawPatch = rawDecision?.planPatch;
  if (!isRecord(rawPatch)) {
    return undefined;
  }

  const addItems = Array.isArray(rawPatch.addItems)
    ? rawPatch.addItems
        .map(normalizeNewPlanItem)
        .filter((item): item is PlannerTaskPlanItem => Boolean(item))
        .filter(
          (item, index, items) =>
            items.findIndex((candidate) => candidate.id === item.id) === index,
        )
    : [];

  const updates = Array.isArray(rawPatch.updates)
    ? rawPatch.updates
        .map((value) => {
          if (!isRecord(value)) {
            return null;
          }
          const id = typeof value.id === "string" ? value.id.trim() : "";
          const status = normalizeStatus(value.status);
          return id && status ? { id, status } : null;
        })
        .filter(
          (item): item is { id: string; status: PlannerTaskPlanItemStatus } =>
            Boolean(item),
        )
    : [];

  const activeItemId =
    typeof rawPatch.activeItemId === "string" && rawPatch.activeItemId.trim()
      ? rawPatch.activeItemId.trim()
      : undefined;
  const revisionReason =
    typeof rawPatch.revisionReason === "string" && rawPatch.revisionReason.trim()
      ? rawPatch.revisionReason.trim()
      : undefined;

  if (
    addItems.length === 0 &&
    updates.length === 0 &&
    !activeItemId &&
    !revisionReason
  ) {
    return undefined;
  }

  return {
    ...(addItems.length > 0 ? { addItems } : {}),
    ...(updates.length > 0 ? { updates } : {}),
    ...(activeItemId ? { activeItemId } : {}),
    ...(revisionReason ? { revisionReason } : {}),
  };
};

const getCurrentPlanList = (frame: CurrentTaskFrame | undefined) => {
  const plannedFrame = frame as CurrentTaskFrameWithPlan | undefined;
  return plannedFrame?.planList ?? plannedFrame?.taskPlan ?? [];
};

const normalizeActivePlan = (
  items: PlannerTaskPlanItem[],
  requestedActiveItemId?: string,
) => {
  const requested = requestedActiveItemId
    ? items.find(
        (item) =>
          item.id === requestedActiveItemId &&
          item.status !== "completed" &&
          item.status !== "blocked",
      )
    : undefined;
  const active =
    requested ??
    items.find((item) => item.status === "in_progress") ??
    items.find((item) => item.status === "pending");

  return {
    activeItemId: active?.id,
    items: items.map((item) => {
      if (!active) {
        return item.status === "in_progress"
          ? { ...item, status: "pending" as const }
          : item;
      }
      if (item.id === active.id) {
        return item.status === "pending"
          ? { ...item, status: "in_progress" as const }
          : item;
      }
      return item.status === "in_progress"
        ? { ...item, status: "pending" as const }
        : item;
    }),
  };
};

/**
 * Runtime owns planList identity and history. The model can only patch status, append new
 * semantic items, and select the active item. Existing items cannot be deleted or silently
 * rewritten by returning a new full plan.
 */
export const applyPlannerTaskPlanPatch = (
  frame: CurrentTaskFrame | undefined,
  patch: PlannerTaskPlanPatch | undefined,
): CurrentTaskFrame | undefined => {
  if (!frame) {
    return frame;
  }

  const plannedFrame = frame as CurrentTaskFrameWithPlan;
  const previousItems = getCurrentPlanList(frame);
  const itemsById = new Map(previousItems.map((item) => [item.id, { ...item }]));

  for (const item of patch?.addItems ?? []) {
    if (!itemsById.has(item.id)) {
      itemsById.set(item.id, { ...item });
    }
  }

  for (const update of patch?.updates ?? []) {
    const current = itemsById.get(update.id);
    if (current) {
      itemsById.set(update.id, { ...current, status: update.status });
    }
  }

  const mergedItems = [...itemsById.values()];
  const normalized = normalizeActivePlan(
    mergedItems,
    patch?.activeItemId ?? plannedFrame.activePlanItemId,
  );
  const changed =
    JSON.stringify(previousItems) !== JSON.stringify(normalized.items) ||
    plannedFrame.activePlanItemId !== normalized.activeItemId;
  const activeItem = normalized.activeItemId
    ? normalized.items.find((item) => item.id === normalized.activeItemId)
    : undefined;
  const remainingWork = normalized.items
    .filter((item) => item.status === "pending" || item.status === "in_progress")
    .map((item) => item.title);
  const completedProgress = normalized.items
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
      : normalized.items.length > 0 &&
          normalized.items.every(
            (item) => item.status === "completed" || item.status === "blocked",
          )
        ? {
            currentSubtask:
              "Verify the completed runtime plan against the full user goal and decide whether to answer or revise the plan.",
          }
        : {}),
    coveredProgress: coveredProgress.length > 0 ? coveredProgress : undefined,
    remainingWork: remainingWork.length > 0 ? remainingWork : undefined,
    planList: normalized.items,
    activePlanItemId: normalized.activeItemId,
    planRevision: changed
      ? (plannedFrame.planRevision ?? 0) + 1
      : plannedFrame.planRevision ?? 0,
    ...(patch?.revisionReason
      ? { planRevisionReason: patch.revisionReason }
      : plannedFrame.planRevisionReason
        ? { planRevisionReason: plannedFrame.planRevisionReason }
        : {}),
    // Remove the previous experimental full-plan field when a frame is rewritten.
    taskPlan: undefined,
  } as CurrentTaskFrame;
};

export const getPlannerTaskPlanDiagnostics = (frame: CurrentTaskFrame | undefined) => {
  const plannedFrame = frame as CurrentTaskFrameWithPlan | undefined;
  const items = getCurrentPlanList(frame);
  return {
    planRevision: plannedFrame?.planRevision ?? 0,
    planItemCount: items.length,
    activePlanItemId: plannedFrame?.activePlanItemId ?? null,
    completedPlanItemCount: items.filter((item) => item.status === "completed").length,
    blockedPlanItemCount: items.filter((item) => item.status === "blocked").length,
  };
};

/**
 * Adds a patch-only plan contract. AgentNextAction remains the only execution decision.
 * planList is runtime-owned state; the model never replaces the full list after creation.
 */
export const withPlannerTaskPlanContract = (
  messages: NormalizedChatMessage[],
): NormalizedChatMessage[] => {
  if (messages.length === 0) {
    return messages;
  }

  const planContract = [
    "RUNTIME PLAN CONTRACT (applies to this Planner response):",
    "Maintain a persistent runtime-owned planList for the full user goal before choosing nextAction.",
    "Plan items are semantic subgoals/outcomes, never a precomputed list of tool calls.",
    "The runtime owns existing plan item identity. You MUST NOT return a full replacement plan.",
    "Return only a top-level planPatch when plan state must change.",
    'planPatch schema: {"addItems":[{"id":"P1","title":"semantic subgoal","status":"pending|in_progress|completed|blocked","completionCriteria":["observable condition"]}],"updates":[{"id":"P1","status":"completed"}],"activeItemId":"P2","revisionReason":"optional concise reason"}',
    "First planning turn: add the initial semantic items and select exactly one active item.",
    "Later turns: evaluate the latest continuous action/result context against the active item, patch completed/blocked status, then continue it, activate the next item, or append genuinely new semantic work discovered from Evidence.",
    "Keep stable ids. Never delete old items, renumber them, or rewrite an existing item's identity just because a new tool result arrived.",
    "nextAction must directly advance the active plan item. Do not wander into unrelated discovery or documentation.",
    "If all plan items are completed, verify the full user goal before answer. If the goal is still not covered, append the missing semantic item before taking another action.",
    "Runtime working memory comes from continuous Agent Loop Context, planList, accumulatedActionLedger, Evidence, and recent observations. There is NO implicit engineering-memory-file feature.",
    "Do NOT search for or open docs/ENGINEERING_MEMORY.md, ENGINEERING_MEMORY.md, MEMORY.md, memory notes, or similarly named files merely to remember prior work, recover a plan, or understand Agent state. Only inspect such a file when the user explicitly asks about that file or it is directly part of the requested task.",
    "The earlier no-extra-fields rule has exactly one exception: top-level planPatch. The canonical action type is still exactly one of answer/retrieve/use_tool/ask_user/error.",
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
