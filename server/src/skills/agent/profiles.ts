import type { SkillAgentExecutionProfile } from "./types.js";

const WENSHU_PI_SKILL_PROFILES = {
  docx: {
    skillId: "docx",
    mode: "forked-agent",
    engine: "pi-agent-core",
    allowedHarnessToolIds: ["read_open", "read_extract"],
    runtimeBindings: [
      {
        id: "office_document",
        kind: "skill-private-runtime",
        status: "ready",
        description: "WenShu DOCX domain runtime; private to the docx Skill agent.",
      },
    ],
    workspaceBound: true,
  },
  pdf: {
    skillId: "pdf",
    mode: "forked-agent",
    engine: "pi-agent-core",
    allowedHarnessToolIds: ["read_open", "read_extract"],
    runtimeBindings: [
      {
        id: "office_pdf",
        kind: "skill-private-runtime",
        status: "ready",
        description: "WenShu PDF domain runtime; private to the pdf Skill agent.",
      },
    ],
    workspaceBound: true,
  },
  pptx: {
    skillId: "pptx",
    mode: "forked-agent",
    engine: "pi-agent-core",
    allowedHarnessToolIds: ["read_open", "read_extract"],
    runtimeBindings: [
      {
        id: "office_presentation",
        kind: "skill-private-runtime",
        status: "ready",
        description:
          "WenShu PPTX adapter -> managed WenShu launcher -> pptx_runtime.py -> bundled Kimi runtime.",
      },
    ],
    workspaceBound: true,
  },
  xlsx: {
    skillId: "xlsx",
    mode: "forked-agent",
    engine: "pi-agent-core",
    allowedHarnessToolIds: ["read_open", "read_extract"],
    runtimeBindings: [
      {
        id: "office_spreadsheet",
        kind: "skill-private-runtime",
        status: "ready",
        description:
          "Legacy XLSX diagnostics runtime (inspect/recalc/verify) kept private to the xlsx Skill agent.",
      },
      {
        id: "wenshu_xlsx_xml_runtime",
        kind: "skill-private-runtime",
        status: "pending",
        description:
          "XML-first create/edit execution bridge. Must bind the Skill package runtime without restoring a global Office tool.",
      },
    ],
    workspaceBound: true,
  },
} satisfies Record<string, SkillAgentExecutionProfile>;

export type WenShuPiSkillId = keyof typeof WENSHU_PI_SKILL_PROFILES;

export const getSkillAgentExecutionProfile = (
  skillId: string,
): SkillAgentExecutionProfile | null => {
  const profile = WENSHU_PI_SKILL_PROFILES[skillId as WenShuPiSkillId];
  if (!profile) return null;
  return {
    ...profile,
    allowedHarnessToolIds: [...profile.allowedHarnessToolIds],
    runtimeBindings: profile.runtimeBindings.map((binding) => ({ ...binding })),
  };
};

export const isWenShuPiSkillPilot = (skillId: string) =>
  Boolean(WENSHU_PI_SKILL_PROFILES[skillId as WenShuPiSkillId]);

export const listWenShuPiSkillProfiles = () =>
  Object.keys(WENSHU_PI_SKILL_PROFILES).map((skillId) =>
    getSkillAgentExecutionProfile(skillId),
  ).filter((profile): profile is SkillAgentExecutionProfile => Boolean(profile));
