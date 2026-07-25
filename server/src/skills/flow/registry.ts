import { fertilityAssessmentRuntime } from "../fertility-assessment/runtime.js";
import {
  FERTILITY_REPORT_INTERNAL_HANDOFF_ID,
  fertilityAssessmentReportRuntime,
} from "../fertility-assessment/runtime/report-handoff.js";
import type {
  SkillConversationFlowRuntime,
  SkillDirectiveHandoffRuntime,
} from "./types.js";

const conversationFlowRuntimes = new Map<string, SkillConversationFlowRuntime>([
  [fertilityAssessmentRuntime.skillId, fertilityAssessmentRuntime],
]);

const directiveHandoffRuntimes = new Map<string, SkillDirectiveHandoffRuntime>([
  // Compatibility lookup for the report stage emitted by the existing flow.
  // The resolved runtime is owned by the single public fertility-assessment
  // Skill and must never be registered as a second conversation flow.
  [FERTILITY_REPORT_INTERNAL_HANDOFF_ID, fertilityAssessmentReportRuntime],
]);

export const getSkillConversationFlowRuntime = (skillId: string) =>
  conversationFlowRuntimes.get(skillId) ?? null;

export const getSkillDirectiveHandoffRuntime = (skillId: string) =>
  directiveHandoffRuntimes.get(skillId) ?? null;

export const listSkillConversationFlowRuntimes = () => [
  ...conversationFlowRuntimes.values(),
];
