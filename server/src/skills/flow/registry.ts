import { fertilityAssessmentRuntime } from "../fertility-assessment/runtime.js";
import { fertilityReportRuntime } from "../fertility-report/runtime.js";
import type {
  SkillConversationFlowRuntime,
  SkillDirectiveHandoffRuntime,
} from "./types.js";

const conversationFlowRuntimes = new Map<string, SkillConversationFlowRuntime>([
  [fertilityAssessmentRuntime.skillId, fertilityAssessmentRuntime],
]);

const directiveHandoffRuntimes = new Map<string, SkillDirectiveHandoffRuntime>([
  [fertilityReportRuntime.skillId, fertilityReportRuntime],
]);

export const getSkillConversationFlowRuntime = (skillId: string) =>
  conversationFlowRuntimes.get(skillId) ?? null;

export const getSkillDirectiveHandoffRuntime = (skillId: string) =>
  directiveHandoffRuntimes.get(skillId) ?? null;

export const listSkillConversationFlowRuntimes = () => [
  ...conversationFlowRuntimes.values(),
];
