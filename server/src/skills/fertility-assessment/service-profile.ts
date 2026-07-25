export type FertilityAssessmentScope = "female" | "male" | "couple";
export type FertilityServiceGoal =
  | "natural_conception"
  | "assisted_reproduction"
  | "failure_review"
  | "general";

export type FertilityServiceProfile = {
  displayName: string;
  assessmentScope: FertilityAssessmentScope;
  subjectGender: "female" | "male" | "couple";
  currentGoal: FertilityServiceGoal;
  femaleName?: string;
  maleName?: string;
  reportProfileId?: string;
  scoringProfileId?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : undefined;

const cleanProfileId = (value: unknown) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(candidate) ? candidate : undefined;
};

export const normalizeFertilityAssessmentScope = (
  value: unknown,
): FertilityAssessmentScope | undefined => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["female", "woman", "女", "女方", "女性", "本人女方"].includes(normalized)) {
    return "female";
  }
  if (["male", "man", "男", "男方", "男性", "本人男方"].includes(normalized)) {
    return "male";
  }
  if (["couple", "both", "夫妻", "双方", "男女双方", "伴侣双方"].includes(normalized)) {
    return "couple";
  }
  return undefined;
};

const normalizeGoal = (value: unknown): FertilityServiceGoal => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (/自然|natural/.test(normalized)) return "natural_conception";
  if (/试管|辅助生殖|人授|ivf|iui|assisted/.test(normalized)) {
    return "assisted_reproduction";
  }
  if (/失败|流产|胎停|复盘|review/.test(normalized)) return "failure_review";
  return "general";
};

export const hasExplicitFertilityServiceProfile = (facts: Record<string, unknown>) => {
  const serviceProfile = isRecord(facts.serviceProfile) ? facts.serviceProfile : {};
  const displayName =
    cleanText(serviceProfile.displayName) ??
    cleanText(serviceProfile.preferredName) ??
    cleanText(facts.displayName) ??
    cleanText(facts.preferredName) ??
    cleanText(facts.name);
  const scope =
    normalizeFertilityAssessmentScope(serviceProfile.assessmentScope) ??
    normalizeFertilityAssessmentScope(serviceProfile.subjectGender) ??
    normalizeFertilityAssessmentScope(facts.assessmentScope) ??
    normalizeFertilityAssessmentScope(facts.gender);
  const goal =
    cleanText(serviceProfile.currentGoal) ??
    cleanText(serviceProfile.goal) ??
    cleanText(facts.currentGoal) ??
    cleanText(facts.goal);

  return Boolean(displayName && scope && goal);
};

export const resolveFertilityServiceProfile = (
  facts: Record<string, unknown>,
): FertilityServiceProfile => {
  const serviceProfile = isRecord(facts.serviceProfile) ? facts.serviceProfile : {};
  const people = isRecord(facts.people) ? facts.people : {};
  const female = isRecord(people.female) ? people.female : {};
  const male = isRecord(people.male) ? people.male : {};

  const femaleName =
    cleanText(serviceProfile.femaleName) ??
    cleanText(female.name) ??
    cleanText(facts.femaleName);
  const maleName =
    cleanText(serviceProfile.maleName) ??
    cleanText(male.name) ??
    cleanText(facts.maleName);

  const assessmentScope =
    normalizeFertilityAssessmentScope(serviceProfile.assessmentScope) ??
    normalizeFertilityAssessmentScope(serviceProfile.subjectGender) ??
    normalizeFertilityAssessmentScope(facts.assessmentScope) ??
    normalizeFertilityAssessmentScope(facts.gender) ??
    (femaleName && maleName ? "couple" : femaleName ? "female" : maleName ? "male" : "couple");

  const explicitDisplayName =
    cleanText(serviceProfile.displayName) ??
    cleanText(serviceProfile.preferredName) ??
    cleanText(facts.displayName) ??
    cleanText(facts.preferredName) ??
    cleanText(facts.name);

  const displayName =
    explicitDisplayName ??
    (assessmentScope === "couple"
      ? femaleName && maleName
        ? `${maleName} · ${femaleName}`
        : "专属客户"
      : assessmentScope === "female"
        ? femaleName ?? "女士"
        : maleName ?? "先生");

  const reportProfileId =
    cleanProfileId(serviceProfile.reportProfileId) ??
    cleanProfileId(serviceProfile.reportTemplateId) ??
    cleanProfileId(facts.reportProfileId) ??
    cleanProfileId(facts.reportTemplateId);
  const scoringProfileId =
    cleanProfileId(serviceProfile.scoringProfileId) ??
    cleanProfileId(facts.scoringProfileId);

  return {
    displayName,
    assessmentScope,
    subjectGender: assessmentScope,
    currentGoal: normalizeGoal(
      serviceProfile.currentGoal ?? serviceProfile.goal ?? facts.currentGoal ?? facts.goal,
    ),
    ...(femaleName ? { femaleName } : {}),
    ...(maleName ? { maleName } : {}),
    ...(reportProfileId ? { reportProfileId } : {}),
    ...(scoringProfileId ? { scoringProfileId } : {}),
  };
};

export const getFertilityScopeFlags = (scope: FertilityAssessmentScope) => ({
  includeFemale: scope === "female" || scope === "couple",
  includeMale: scope === "male" || scope === "couple",
});

export const getFertilityGoalLabel = (goal: FertilityServiceGoal) => {
  switch (goal) {
    case "natural_conception":
      return "自然备孕专项评估";
    case "assisted_reproduction":
      return "辅助生殖专项评估";
    case "failure_review":
      return "既往失败经历复盘评估";
    case "general":
    default:
      return "生育力综合评估";
  }
};

export const getFertilityScopeLabel = (scope: FertilityAssessmentScope) => {
  switch (scope) {
    case "female":
      return "女性个人十维评估";
    case "male":
      return "男性个人十维评估";
    case "couple":
    default:
      return "夫妻双方十维联合评估";
  }
};