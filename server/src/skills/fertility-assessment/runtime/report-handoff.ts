import { fertilityReportRuntime } from "../../fertility-report/runtime.js";
import type {
  SkillDirective,
  SkillDirectiveHandoffRuntime,
} from "../../flow/types.js";

const PUBLIC_SKILL_ID = "fertility-assessment";

const normalizeDirectiveToAssessmentSkill = (
  directive: SkillDirective,
): SkillDirective => ({
  ...directive,
  skillId: PUBLIC_SKILL_ID,
  ...(directive.next
    ? {
        next: {
          ...directive.next,
          ...(directive.next.targetSkillId
            ? { targetSkillId: PUBLIC_SKILL_ID }
            : {}),
        },
      }
    : {}),
});

/**
 * Report generation is an internal execution stage of fertility-assessment.
 *
 * The legacy renderer remains isolated in ../fertility-report/runtime.ts for now,
 * but it is no longer a discoverable Skill package. This adapter keeps runtime
 * output and trace ownership on the single public fertility-assessment Skill ID.
 */
export const fertilityAssessmentReportRuntime: SkillDirectiveHandoffRuntime = {
  skillId: PUBLIC_SKILL_ID,
  version: "1.0.0",

  async execute(input) {
    const result = await fertilityReportRuntime.execute(input);
    const directive = normalizeDirectiveToAssessmentSkill(result.directive);

    return {
      ...result,
      session: {
        ...result.session,
        skillId: PUBLIC_SKILL_ID,
        lastDirective: directive,
      },
      directive,
    };
  },
};
