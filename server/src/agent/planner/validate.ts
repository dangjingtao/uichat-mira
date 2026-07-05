import type { AgentNextAction } from "../types";
import { INVALID_PLANNER_OUTPUT_REASON, toNextActionFallback } from "./action-types";
import type { PlannerOutputParseResult } from "./parse";

export const validateNextAction = (
  parseResult: PlannerOutputParseResult,
  exposedTools: string[],
): {
  action: AgentNextAction;
  parseErrorReason?: string;
  sanitizedOutput?: string;
  parseWarnings?: string[];
} => {
  if (!parseResult.action) {
    return {
      action: toNextActionFallback(INVALID_PLANNER_OUTPUT_REASON),
      parseErrorReason: parseResult.parseErrorReason ?? INVALID_PLANNER_OUTPUT_REASON,
      sanitizedOutput: parseResult.sanitizedOutput,
      parseWarnings: parseResult.parseWarnings,
    };
  }

  if (
    parseResult.action.type === "use_tool" &&
    !exposedTools.includes(parseResult.action.toolId)
  ) {
    return {
      action: toNextActionFallback(
        "Planner selected a tool that was not exposed for this turn; planner must stop.",
      ),
      sanitizedOutput: parseResult.sanitizedOutput,
      parseWarnings: parseResult.parseWarnings,
    };
  }

  return {
    action: parseResult.action,
    sanitizedOutput: parseResult.sanitizedOutput,
    parseWarnings: parseResult.parseWarnings,
  };
};
