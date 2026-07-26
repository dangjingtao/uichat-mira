import type { RagNodeLike } from "./ragTypes";

export type SubAgentWorkingPhase =
  | "planning"
  | "working"
  | "waiting_approval"
  | "waiting_input"
  | "blocked"
  | "completed"
  | "failed";

export type SubAgentWorkingState = {
  runId: string;
  skillId: string;
  phase: SubAgentWorkingPhase;
  currentJudgement?: string;
  currentAction: string;
  nextAction?: string;
  blockingReason?: string;
  updatedAt: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asString = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const asPhase = (value: unknown): SubAgentWorkingPhase | undefined => {
  const phase = asString(value);
  return phase &&
    [
      "planning",
      "working",
      "waiting_approval",
      "waiting_input",
      "blocked",
      "completed",
      "failed",
    ].includes(phase)
    ? (phase as SubAgentWorkingPhase)
    : undefined;
};

const parseWorkingState = (value: unknown): SubAgentWorkingState | null => {
  if (!isRecord(value)) return null;
  const runId = asString(value.runId);
  const skillId = asString(value.skillId);
  const phase = asPhase(value.phase);
  const currentAction = asString(value.currentAction);
  const updatedAt =
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : undefined;
  if (!runId || !skillId || !phase || !currentAction || updatedAt === undefined) {
    return null;
  }
  return {
    runId,
    skillId,
    phase,
    currentAction,
    updatedAt,
    ...(asString(value.currentJudgement)
      ? { currentJudgement: asString(value.currentJudgement) }
      : {}),
    ...(asString(value.nextAction) ? { nextAction: asString(value.nextAction) } : {}),
    ...(asString(value.blockingReason)
      ? { blockingReason: asString(value.blockingReason) }
      : {}),
  };
};

export const isSubAgentWorkingStateNode = (step: RagNodeLike) =>
  step.details?.subAgentWorkingState === true;

export const isSubAgentTraceStep = (step: RagNodeLike) =>
  step.details?.subAgentTraceEvent === true;

const getSubAgentSeq = (step: RagNodeLike) => {
  const value = step.details?.subAgentSeq;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export const getLatestSubAgentWorkingState = (
  steps: RagNodeLike[],
): SubAgentWorkingState | null => {
  let latest: SubAgentWorkingState | null = null;
  for (const step of steps) {
    if (!isSubAgentWorkingStateNode(step)) continue;
    const state = parseWorkingState(step.details?.workingState);
    if (!state) continue;
    if (!latest || state.updatedAt >= latest.updatedAt) latest = state;
  }
  return latest;
};

export const getSubAgentTraceSteps = (steps: RagNodeLike[]) =>
  steps
    .filter(isSubAgentTraceStep)
    .map((step, index) => ({ step, index, seq: getSubAgentSeq(step) }))
    .sort((left, right) => {
      if (left.seq !== null && right.seq !== null) {
        return left.seq - right.seq || left.index - right.index;
      }
      if (left.seq !== null) return -1;
      if (right.seq !== null) return 1;
      return left.index - right.index;
    })
    .map((entry) => entry.step);

export const getLatestSubAgentTraceTitle = (steps: RagNodeLike[]) => {
  const latest = getSubAgentTraceSteps(steps).at(-1);
  return latest?.label?.trim() || null;
};

/** State snapshots are persisted execution nodes, but they are not historical
 * Trace rows. Keep them out of the expandable list while retaining all ordinary
 * Agent/RAG events and the append-only subAgent Trace ledger. */
export const getDisplayExecutionSteps = (steps: RagNodeLike[]) =>
  steps.filter((step) => !isSubAgentWorkingStateNode(step));
