export type SkillIconKind = "spreadsheet" | "pdf" | "word" | "presentation" | "markdown";

export type SkillPresentation = {
  id: string;
  icon: SkillIconKind;
  usePath?: string;
};

/**
 * Frontend-only presentation overrides.
 *
 * Skill names, descriptions, source, category, files and content come from the
 * canonical /skills API. Keeping only visual/navigation hints here prevents the
 * desktop bundle from becoming a second Skill package truth source.
 */
export const skillPresentations: SkillPresentation[] = [
  { id: "xlsx", icon: "spreadsheet", usePath: "/settings/micro-apps/office-suite" },
  { id: "pdf", icon: "pdf", usePath: "/settings/micro-apps/office-suite" },
  { id: "docx", icon: "word", usePath: "/settings/micro-apps/office-suite" },
  { id: "pptx", icon: "presentation", usePath: "/settings/micro-apps/office-suite" },
];

export const getSkillPresentation = (id: string): SkillPresentation =>
  skillPresentations.find((skill) => skill.id === id) ?? { id, icon: "markdown" };
