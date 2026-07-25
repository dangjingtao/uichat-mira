import { fertilityReportRuntime } from "../../fertility-report/runtime.js";
import type {
  SkillDirective,
  SkillDirectiveHandoffRuntime,
} from "../../flow/types.js";

export const FERTILITY_ASSESSMENT_PUBLIC_SKILL_ID = "fertility-assessment";
export const FERTILITY_REPORT_INTERNAL_HANDOFF_ID = "fertility-report";

const normalizeDirectiveToAssessmentSkill = (
  directive: SkillDirective,
): SkillDirective => ({
  ...directive,
  skillId: FERTILITY_ASSESSMENT_PUBLIC_SKILL_ID,
  ...(directive.next
    ? {
        next: {
          ...directive.next,
          ...(directive.next.targetSkillId
            ? { targetSkillId: FERTILITY_ASSESSMENT_PUBLIC_SKILL_ID }
            : {}),
        },
      }
    : {}),
});

/**
 * Report generation is an internal execution stage of fertility-assessment.
 *
 * `fertility-report` is retained only as the existing internal handoff lookup
 * key. It is not a second public Skill, does not start another conversation
 * flow, and must not change the assessment -> final confirmation -> report
 * delivery sequence. Runtime output and trace ownership remain on the single
 * public fertility-assessment Skill ID.
 */
export const fertilityAssessmentReportRuntime: SkillDirectiveHandoffRuntime = {
  skillId: FERTILITY_ASSESSMENT_PUBLIC_SKILL_ID,
  version: "1.0.0",

  async execute(input) {
    const result = await fertilityReportRuntime.execute(input);
    const directive = normalizeDirectiveToAssessmentSkill(result.directive);

    return {
      ...result,
      session: {
        ...result.session,
        skillId: FERTILITY_ASSESSMENT_PUBLIC_SKILL_ID,
        lastDirective: directive,
      },
      directive,
    };
  },
};
