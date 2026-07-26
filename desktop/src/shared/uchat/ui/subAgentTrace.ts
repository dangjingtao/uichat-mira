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
    ...(asString(value.nextAction)
      ? { nextAction: asString(value.nextAction) }
      : {}),
    ...(asString(value.blockingReason)
      ? { blockingReason: asString(value.blockingReason) }
      : {}),
  };
};

export const isSubAgentWorkingStateNode = (step: RagNodeLike) =>
  step.details?.subAgentWorkingState === true;

const isSubAgentDelegationStep = (step: RagNodeLike) => {
  if (step.details?.subAgentDelegation === true) return true;

  const text = `${step.nodeId} ${step.label} ${step.summary ?? ""}`.toLowerCase();
  const namesSubAgent = text.includes("subagent") || text.includes("子代理");
  const namesDelegation =
    text.includes("dispatch") ||
    text.includes("delegate") ||
    text.includes("delegation") ||
    text.includes("委派");

  return namesSubAgent && namesDelegation;
};

/**
 * The parent delegation row is a hand-off event, not a long-running activity.
 * Treat it as part of the append-only subAgent trace so the UI completes that
 * row instead of leaving an earlier spinner above later child steps.
 */
export const isSubAgentTraceStep = (step: RagNodeLike) =>
  step.details?.subAgentTraceEvent === true || isSubAgentDelegationStep(step);

const getSubAgentSeq = (step: RagNodeLike) => {
  const value = step.details?.subAgentSeq;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const getSubAgentRunId = (step: RagNodeLike) =>
  asString(step.details?.subAgentRunId) ?? null;

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
    .map((step, index) => ({
      step,
      index,
      runId: getSubAgentRunId(step),
      seq: getSubAgentSeq(step),
    }))
    .sort((left, right) => {
      // SSE/message data parts already preserve append order across runs. Only
      // repair ordering within the same run, where seq is authoritative.
      if (
        left.runId &&
        right.runId &&
        left.runId === right.runId &&
        left.seq !== null &&
        right.seq !== null
      ) {
        return left.seq - right.seq || left.index - right.index;
      }
      return left.index - right.index;
    })
    .map((entry) => entry.step);

export const getLatestSubAgentTraceTitle = (
  steps: RagNodeLike[],
  runId?: string,
) => {
  const ordered = getSubAgentTraceSteps(steps);
  const latest = ordered.at(-1);
  const activeRunId = runId ?? (latest ? getSubAgentRunId(latest) : null);
  const candidates = ordered.filter(
    (step) => !activeRunId || getSubAgentRunId(step) === activeRunId,
  );
  return candidates.at(-1)?.label?.trim() || null;
};

const normalizeDelegationPhase = (step: RagNodeLike): RagNodeLike =>
  isSubAgentDelegationStep(step) && step.phase === "start"
    ? { ...step, phase: "done" }
    : step;

/** State snapshots are persisted execution nodes, but they are not historical
 * Trace rows. Keep them out of the expandable list while retaining all ordinary
 * Agent/RAG events and the append-only subAgent Trace ledger. Delegation itself
 * is normalized to a completed hand-off so status, numbering and step totals
 * remain one-way and consistent. */
export const getDisplayExecutionSteps = (steps: RagNodeLike[]) =>
  steps
    .filter((step) => !isSubAgentWorkingStateNode(step))
    .map(normalizeDelegationPhase);
