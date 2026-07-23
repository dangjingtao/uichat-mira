import { fertilityAssessmentRuntime } from "../fertility-assessment/runtime.js";
import type { SkillConversationFlowRuntime } from "./types.js";

const runtimes = new Map<string, SkillConversationFlowRuntime>([
  [fertilityAssessmentRuntime.skillId, fertilityAssessmentRuntime],
]);

export const getSkillConversationFlowRuntime = (skillId: string) =>
  runtimes.get(skillId) ?? null;

export const listSkillConversationFlowRuntimes = () => [...runtimes.values()];
