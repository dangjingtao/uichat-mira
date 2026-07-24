import { fertilityAssessmentRuntime } from "../fertility-assessment/runtime.js";
import { fertilityAssessmentReportRuntime } from "../fertility-assessment/runtime/report-handoff.js";
import type {
  SkillConversationFlowRuntime,
  SkillDirectiveHandoffRuntime,
} from "./types.js";

const conversationFlowRuntimes = new Map<string, SkillConversationFlowRuntime>([
  [fertilityAssessmentRuntime.skillId, fertilityAssessmentRuntime],
]);

const directiveHandoffRuntimes = new Map<string, SkillDirectiveHandoffRuntime>([
  // Legacy internal handoff key emitted by the current assessment runtime.
  // It resolves to an execution stage owned by the single public
  // fertility-assessment Skill and is not a discoverable Skill package.
  ["fertility-report", fertilityAssessmentReportRuntime],
]);

export const getSkillConversationFlowRuntime = (skillId: string) =>
  conversationFlowRuntimes.get(skillId) ?? null;

export const getSkillDirectiveHandoffRuntime = (skillId: string) =>
  directiveHandoffRuntimes.get(skillId) ?? null;

export const listSkillConversationFlowRuntimes = () => [
  ...conversationFlowRuntimes.values(),
];
