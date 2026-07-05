import type { AgentNextAction } from "../types";

const stripThinkBlocks = (value: string) =>
  value.replace(/^\s*(?:<think\b[^>]*>[\s\S]*?<\/think>\s*)+/i, "").trim();

const sanitizePlannerJson = (value: string) =>
  stripThinkBlocks(value)
    .replace(/```json/gi, "```")
    .replace(/```[\r\n]?/g, "")
    .trim();

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export type PlannerOutputParseResult = {
  action: AgentNextAction | null;
  sanitizedOutput: string;
  parseErrorReason: string | null;
  parseWarnings: string[];
};

const MISSING_REASON_DEFAULTED_WARNING = "missing_reason_defaulted";

const getDefaultPlannerReason = (
  type: AgentNextAction["type"],
  payload: Record<string, unknown>,
) => {
  switch (type) {
    case "answer":
      return "Planner selected final answer.";
    case "retrieve":
      return `Planner requested retrieval for query: ${String(payload.query ?? "").trim()}.`;
    case "use_tool":
      return `Planner selected tool ${String(payload.toolId ?? "").trim()}.`;
    case "error":
      return "Planner returned an error action without a reason.";
  }
};

const extractJsonObjectCandidates = (value: string) => {
  const candidates: string[] = [];
  let startIndex = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (!char) {
      continue;
    }

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        startIndex = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        candidates.push(value.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  return candidates;
};

const parseNextActionPlannerObject = (
  parsed: Record<string, unknown>,
): PlannerOutputParseResult => {
  if (typeof parsed.type !== "string") {
    return {
      action: null,
      sanitizedOutput: "",
      parseErrorReason: 'Planner JSON object must include a string "type" field.',
      parseWarnings: [],
    };
  }

  const parseWarnings: string[] = [];
  const reason: string =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim()
      : (() => {
          parseWarnings.push(MISSING_REASON_DEFAULTED_WARNING);
          return (
            getDefaultPlannerReason(parsed.type as AgentNextAction["type"], parsed) ??
            "Planner returned an error action without a reason."
          );
        })();

  switch (parsed.type) {
    case "answer":
      return {
        action: {
          type: "answer",
          reason,
        },
        sanitizedOutput: "",
        parseErrorReason: null,
        parseWarnings,
      };
    case "retrieve":
      if (typeof parsed.query !== "string" || !parsed.query.trim()) {
        return {
          action: null,
          sanitizedOutput: "",
          parseErrorReason:
            'Planner "retrieve" action must include a non-empty string "query" field.',
          parseWarnings: [],
        };
      }
      return {
        action: {
          type: "retrieve",
          query: parsed.query.trim(),
          reason,
        },
        sanitizedOutput: "",
        parseErrorReason: null,
        parseWarnings,
      };
    case "use_tool":
      if (typeof parsed.toolId !== "string" || !parsed.toolId.trim()) {
        return {
          action: null,
          sanitizedOutput: "",
          parseErrorReason:
            'Planner "use_tool" action must include a non-empty string "toolId" field.',
          parseWarnings: [],
        };
      }
      if (!isPlainObject(parsed.args)) {
        return {
          action: null,
          sanitizedOutput: "",
          parseErrorReason:
            'Planner "use_tool" action must include an object-valued "args" field.',
          parseWarnings: [],
        };
      }
      return {
        action: {
          type: "use_tool",
          toolId: parsed.toolId.trim(),
          args: parsed.args,
          reason,
        },
        sanitizedOutput: "",
        parseErrorReason: null,
        parseWarnings,
      };
    case "error":
      return {
        action: {
          type: "error",
          reason,
        },
        sanitizedOutput: "",
        parseErrorReason: null,
        parseWarnings,
      };
    default:
      return {
        action: null,
        sanitizedOutput: "",
        parseErrorReason: `Planner action type "${parsed.type}" is not allowed.`,
        parseWarnings: [],
      };
  }
};

export const parseNextActionPlannerOutputWithDiagnostics = (
  value: string,
): PlannerOutputParseResult => {
  const sanitized = sanitizePlannerJson(value);
  if (!sanitized) {
    return {
      action: null,
      sanitizedOutput: sanitized,
      parseErrorReason: "Planner output was empty after sanitization.",
      parseWarnings: [],
    };
  }

  const candidates = extractJsonObjectCandidates(sanitized);
  if (candidates.length === 0) {
    return {
      action: null,
      sanitizedOutput: sanitized,
      parseErrorReason: "Planner output did not contain a complete JSON object.",
      parseWarnings: [],
    };
  }

  if (candidates.length > 1) {
    return {
      action: null,
      sanitizedOutput: sanitized,
      parseErrorReason:
        "Planner output contained multiple JSON objects; planner must return exactly one decision object.",
      parseWarnings: [],
    };
  }

  try {
    const parsed = JSON.parse(candidates[0]!) as unknown;
    if (!isPlainObject(parsed)) {
      return {
        action: null,
        sanitizedOutput: sanitized,
        parseErrorReason: "Planner decision must be a JSON object.",
        parseWarnings: [],
      };
    }

    const result = parseNextActionPlannerObject(parsed);
    return {
      action: result.action,
      sanitizedOutput: sanitized,
      parseErrorReason: result.parseErrorReason,
      parseWarnings: result.parseWarnings,
    };
  } catch (error) {
    return {
      action: null,
      sanitizedOutput: sanitized,
      parseErrorReason:
        error instanceof Error && error.message.trim()
          ? `Planner JSON parse failed: ${error.message.trim()}`
          : "Planner JSON parse failed.",
      parseWarnings: [],
    };
  }
};

export const parseNextActionPlannerOutput = (value: string): AgentNextAction | null =>
  parseNextActionPlannerOutputWithDiagnostics(value).action;
