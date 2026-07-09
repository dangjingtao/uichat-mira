import type { AgentCoverageState } from "../coverage-state";
import type {
  AgentNextAction,
  AgentToolExposureState,
  PlannerObservationRecoveryContext,
} from "../types";

export interface CoverageTransitionInput {
  question: string;
  coverageState: AgentCoverageState;
  toolExposure: AgentToolExposureState;
  recovery: PlannerObservationRecoveryContext;
  pendingApproval?: unknown;
  iteration: number;
  maxIterations: number;
}

export interface CoverageTransitionDecision {
  nextAction?: AgentNextAction;
  reason: string;
  source: "coverage-transition";
}

const hasTool = (input: CoverageTransitionInput, toolId: string) =>
  input.toolExposure.exposedTools.includes(toolId);

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isExplicitPathTarget = (target: string) =>
  /[\\/]/.test(target) || /\.[A-Za-z0-9_-]{1,12}$/.test(target);

const toDisplayTarget = (question: string, target: string) => {
  const normalizedQuestion = question.replaceAll("\\", "/");
  const pattern = new RegExp(
    escapeRegex(target).replaceAll("/", "[\\\\/]"),
    "i",
  );
  const match = normalizedQuestion.match(pattern);
  return match?.[0] ?? target;
};

const extractTerminalCommand = (question: string) => {
  const normalized = question.trim();
  const englishMatch = normalized.match(
    /\b(?:run|execute)\s+(.+)/i,
  );
  if (englishMatch?.[1]?.trim()) {
    return englishMatch[1].trim();
  }

  const chineseMatch = normalized.match(
    /(?:执行|运行|跑一下|run command)\s+(.+)/u,
  );
  if (chineseMatch?.[1]?.trim()) {
    return chineseMatch[1].trim();
  }

  return undefined;
};

const deriveSearchQuery = (question: string) => {
  const normalized = question
    .trim()
    .replace(
      /^(?:请(?:你)?|帮我|麻烦你|麻烦)?\s*(?:(?:联网|上网|在线|internet|web)\s*)?(?:搜索|查一下|查找|search(?: for)?)\s*/iu,
      "",
    )
    .trim();

  const latestNormalized = normalized.replace(
    /^(?:(?:今天|今日|当前|现在)\s*)?(?:最新(?:的)?|最近(?:的)?|latest)\s*/iu,
    "latest ",
  );

  return latestNormalized.trim() || question.trim();
};

const deriveMutationOperation = (question: string) => {
  if (/\b(delete|remove)\b/i.test(question) || /删除|移除|删掉/u.test(question)) {
    return "delete" as const;
  }

  if (/\b(move|rename)\b/i.test(question) || /移动|重命名/u.test(question)) {
    return "move" as const;
  }

  if (
    /\b(write|rewrite|modify|update|replace|create|overwrite)\b/i.test(question) ||
    /写入|修改|编辑|替换|创建|新建|覆盖/u.test(question)
  ) {
    return "write" as const;
  }

  return undefined;
};

const extractMutationWriteContent = (question: string) => {
  const quotedMatches = [...question.matchAll(/["'“”‘’]([^"'“”‘’]+)["'“”‘’]/g)];
  const lastQuoted = quotedMatches.at(-1)?.[1]?.trim();
  if (lastQuoted) {
    return lastQuoted;
  }

  const chineseMatch = question.match(/写入\s+\S+\s+(?:内容为|为)\s+(.+)/u);
  if (chineseMatch?.[1]?.trim()) {
    return chineseMatch[1].trim();
  }

  return undefined;
};

const buildLocateAction = (
  input: CoverageTransitionInput,
  targets: string[],
): CoverageTransitionDecision | undefined => {
  if (!hasTool(input, "read_locate") || targets.length === 0) {
    return undefined;
  }

  return {
    nextAction: {
      type: "use_tool",
      toolId: "read_locate",
      args: {
        query: targets.map((target) => toDisplayTarget(input.question, target)).join(" "),
      },
      reason: `Coverage transition: locate the remaining target${targets.length > 1 ? "s" : ""} before continuing.`,
    },
    reason: "Coverage transition selected read_locate for uncovered targets.",
    source: "coverage-transition",
  };
};

const buildReadContentAction = (
  input: CoverageTransitionInput,
): CoverageTransitionDecision | undefined => {
  const nextTarget = input.coverageState.targets.find(
    (entry) => entry.pendingActions.includes("read_open") || entry.status === "pending",
  );
  if (!nextTarget) {
    return undefined;
  }

  if (
    hasTool(input, "read_open") &&
    (nextTarget.status === "located" || isExplicitPathTarget(nextTarget.target))
  ) {
    const targetPath = toDisplayTarget(input.question, nextTarget.target);
    return {
      nextAction: {
        type: "use_tool",
        toolId: "read_open",
        args: {
          path: targetPath,
        },
        reason: `Coverage transition: open ${targetPath} to satisfy the file-content request.`,
      },
      reason: "Coverage transition selected read_open for the next file-content target.",
      source: "coverage-transition",
    };
  }

  return buildLocateAction(input, [nextTarget.target]);
};

const buildMutationAction = (
  input: CoverageTransitionInput,
): CoverageTransitionDecision | undefined => {
  const nextTarget = input.coverageState.targets.find(
    (entry) =>
      entry.pendingActions.includes("mutation_execution") ||
      entry.pendingActions.includes("mutation_verification") ||
      entry.status === "pending" ||
      entry.status === "located" ||
      entry.status === "mutated",
  );
  if (!nextTarget) {
    return undefined;
  }

  if (nextTarget.pendingActions.includes("mutation_verification")) {
    if (hasTool(input, "read_open")) {
      const targetPath = toDisplayTarget(input.question, nextTarget.target);
      return {
        nextAction: {
          type: "use_tool",
          toolId: "read_open",
          args: {
            path: targetPath,
          },
          reason: `Coverage transition: open ${targetPath} to verify the mutation result before answering.`,
        },
        reason: "Coverage transition selected read_open for mutation verification.",
        source: "coverage-transition",
      };
    }

    if (hasTool(input, "read_extract")) {
      const targetPath = toDisplayTarget(input.question, nextTarget.target);
      return {
        nextAction: {
          type: "use_tool",
          toolId: "read_extract",
          args: {
            path: targetPath,
          },
          reason: `Coverage transition: inspect ${targetPath} to verify the mutation result before answering.`,
        },
        reason: "Coverage transition selected read_extract for mutation verification.",
        source: "coverage-transition",
      };
    }
  }

  if (
    nextTarget.pendingActions.includes("mutation_execution") ||
    nextTarget.status === "pending" ||
    nextTarget.status === "located"
  ) {
    const operation = deriveMutationOperation(input.question);
    if (hasTool(input, "workspace_mutation") && operation && nextTarget.target) {
      const targetPath = toDisplayTarget(input.question, nextTarget.target);
      const args: Record<string, unknown> = {
        operation,
        targetPath,
      };

      if (operation === "write") {
        const content = extractMutationWriteContent(input.question);
        if (!content) {
          return buildLocateAction(input, [nextTarget.target]);
        }
        args.content = content;
        args.overwrite = true;
      }

      return {
        nextAction: {
          type: "use_tool",
          toolId: "workspace_mutation",
          args,
          reason: `Coverage transition: execute the required ${operation} mutation on ${targetPath} before answering.`,
        },
        reason: "Coverage transition selected workspace_mutation for the next mutation target.",
        source: "coverage-transition",
      };
    }

    return buildLocateAction(input, [nextTarget.target]);
  }

  return undefined;
};

const buildListAction = (
  input: CoverageTransitionInput,
): CoverageTransitionDecision | undefined => {
  if (!input.coverageState.globalPendingActions.includes("read_list")) {
    return undefined;
  }
  if (!hasTool(input, "read_list")) {
    return undefined;
  }

  return {
    nextAction: {
      type: "use_tool",
      toolId: "read_list",
      args: {
        path: ".",
      },
      reason: "Coverage transition: list the workspace directory before answering.",
    },
    reason: "Coverage transition selected read_list for directory coverage.",
    source: "coverage-transition",
  };
};

const buildSearchAction = (
  input: CoverageTransitionInput,
): CoverageTransitionDecision | undefined => {
  if (!input.coverageState.globalPendingActions.includes("search_execution")) {
    return undefined;
  }

  const query = deriveSearchQuery(input.question);
  if (hasTool(input, "web_search")) {
    return {
      nextAction: {
        type: "use_tool",
        toolId: "web_search",
        args: {
          query,
        },
        reason: "Coverage transition: gather the requested external search evidence before answering.",
      },
      reason: "Coverage transition selected web_search for pending search coverage.",
      source: "coverage-transition",
    };
  }

  return {
    nextAction: {
      type: "retrieve",
      query,
      reason: "Coverage transition: gather the requested search evidence before answering.",
    },
    reason: "Coverage transition selected retrieve for pending search coverage.",
    source: "coverage-transition",
  };
};

const buildTerminalAction = (
  input: CoverageTransitionInput,
): CoverageTransitionDecision | undefined => {
  if (!input.coverageState.globalPendingActions.includes("terminal_execution")) {
    return undefined;
  }
  if (!hasTool(input, "terminal_session")) {
    return undefined;
  }

  const command = extractTerminalCommand(input.question);
  if (!command) {
    return undefined;
  }

  return {
    nextAction: {
      type: "use_tool",
      toolId: "terminal_session",
      args: {
        command,
      },
      reason: `Coverage transition: run "${command}" before answering the command request.`,
    },
    reason: "Coverage transition selected terminal_session for pending terminal coverage.",
    source: "coverage-transition",
  };
};

export const getCoverageTransitionDecision = (
  input: CoverageTransitionInput,
): CoverageTransitionDecision => {
  const hasDeterministicCoverageTask =
    input.coverageState.requiredWork.requiredActions.length > 0 ||
    input.coverageState.requiredWork.requiredTargets.length > 0 ||
    input.coverageState.globalPendingActions.length > 0;

  if (!hasDeterministicCoverageTask) {
    return {
      nextAction: undefined,
      reason: "Coverage transition found no stable required work and will fall back to the task model.",
      source: "coverage-transition",
    };
  }

  if (input.pendingApproval) {
    return {
      nextAction: undefined,
      reason: "Coverage transition will not continue while an approval is pending.",
      source: "coverage-transition",
    };
  }

  if (input.recovery.exhausted) {
    return {
      nextAction: undefined,
      reason: "Coverage transition will not continue because recovery is exhausted.",
      source: "coverage-transition",
    };
  }

  if (
    input.coverageState.taskCompletable &&
    input.coverageState.pendingTargets.length === 0 &&
    input.coverageState.pendingActions.length === 0 &&
    input.recovery.source === "none"
  ) {
    return {
      nextAction: {
        type: "answer",
        reason: "Coverage transition: coverage is complete and the planner can answer safely.",
      },
      reason: "Coverage transition selected answer because coverage is complete.",
      source: "coverage-transition",
    };
  }

  const actionBuilders = [
    buildListAction,
    (value: CoverageTransitionInput) =>
      value.coverageState.requiredWork.requiredActions.includes("locate")
        ? buildLocateAction(value, value.coverageState.pendingTargets)
        : undefined,
    (value: CoverageTransitionInput) =>
      value.coverageState.requiredWork.requiredActions.includes("read_content")
        ? buildReadContentAction(value)
        : undefined,
    (value: CoverageTransitionInput) =>
      value.coverageState.requiredWork.requiredActions.includes("mutate")
        ? buildMutationAction(value)
        : undefined,
    buildTerminalAction,
    buildSearchAction,
  ];

  for (const buildAction of actionBuilders) {
    const decision = buildAction(input);
    if (decision?.nextAction) {
      return decision;
    }
  }

  return {
    nextAction: undefined,
    reason: "Coverage transition found no deterministic next action and will fall back to the task model.",
    source: "coverage-transition",
  };
};
