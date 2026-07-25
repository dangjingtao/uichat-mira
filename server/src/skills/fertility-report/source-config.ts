import fs from "node:fs";
import path from "node:path";

export type FertilityReportTheme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  softBackground: string;
  textColor: string;
  mutedTextColor: string;
};

export type FertilityReportProfile = {
  id: string;
  brandName: string;
  teamName: string;
  serviceLine: string;
  footerText: string;
  deliveryLabel: string;
  theme: FertilityReportTheme;
};

export type FertilitySignalEffectMap = {
  favorable: number;
  neutral: number;
  mild_concern: number;
  moderate_concern: number;
  high_concern: number;
  unknown: number;
};

export type FertilityDimensionCalibration = {
  baseScore?: number;
  scoreOffset?: number;
  minScore?: number;
  maxScore?: number;
  criterionWeights: Record<string, number>;
};

export type FertilityScoringProfile = {
  id: string;
  version: string;
  mode: "preserve_builtin" | "recalculate_configured_dimensions";
  noEvidenceReferenceScore: number;
  statusEffect: FertilitySignalEffectMap;
  dimensions: Record<string, FertilityDimensionCalibration>;
};

export type FertilitySourceBundle = {
  reportProfile: FertilityReportProfile;
  scoringProfile: FertilityScoringProfile;
  diagnostics: string[];
};

const DEFAULT_REPORT_PROFILE: FertilityReportProfile = {
  id: "yuanjie",
  brandName: "圆姐聊女性全周期服务",
  teamName: "Mira 生育健康评估服务团队",
  serviceLine: "备孕从了解自己开始，陪伴你一起接好孕。",
  footerText:
    "本报告用于健康教育、信息整理和就诊准备，不构成诊断、处方或替代生殖专科医生的医疗决策。",
  deliveryLabel: "专属服务团队交付",
  theme: {
    primaryColor: "#5B2A86",
    secondaryColor: "#D79ACB",
    accentColor: "#8FB5E8",
    softBackground: "#F7F2FA",
    textColor: "#2C2530",
    mutedTextColor: "#766B79",
  },
};

const DEFAULT_SCORING_PROFILE: FertilityScoringProfile = {
  id: "clinical-default",
  version: "fertility-rubric-v2.0.0",
  mode: "preserve_builtin",
  noEvidenceReferenceScore: 5,
  statusEffect: {
    favorable: 0.8,
    neutral: 0,
    mild_concern: -0.75,
    moderate_concern: -1.45,
    high_concern: -2.35,
    unknown: 0,
  },
  dimensions: {},
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const cleanText = (value: unknown, fallback: string, limit = 300) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, limit)
    : fallback;

const cleanId = (value: unknown, fallback: string) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  return /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(candidate) ? candidate : fallback;
};

const cleanNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

const cleanColor = (value: unknown, fallback: string) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toUpperCase()
    : fallback;

const sourceRoots = () => {
  const entryDir = path.dirname(path.resolve(process.argv[1] || process.cwd()));
  const configured = process.env.MIRA_SKILLS_ROOT?.trim();
  return [
    configured,
    path.join(process.cwd(), "src", "skills"),
    path.join(process.cwd(), "server", "src", "skills"),
    path.join(process.cwd(), "skills"),
    path.join(process.cwd(), ".artifacts", "server-bundle", "skills"),
    path.join(entryDir, "skills"),
    path.join(entryDir, "src", "skills"),
    path.join(entryDir, "server", "src", "skills"),
  ].filter((item): item is string => Boolean(item));
};

const resolveReferencePath = (filename: string) => {
  const relative = path.join(
    "健康",
    "fertility-assessment",
    "references",
    filename,
  );
  return sourceRoots()
    .map((root) => path.join(root, relative))
    .find((candidate) => fs.existsSync(candidate));
};

type JsonCacheEntry = {
  path: string;
  mtimeMs: number;
  value: unknown;
};

const jsonCache = new Map<string, JsonCacheEntry>();

const readJsonSource = (filename: string, diagnostics: string[]) => {
  const resolved = resolveReferencePath(filename);
  if (!resolved) {
    diagnostics.push(`未找到运行时 Source：${filename}，已使用内置默认值。`);
    return undefined;
  }

  try {
    const stat = fs.statSync(resolved);
    const cached = jsonCache.get(filename);
    if (cached && cached.path === resolved && cached.mtimeMs === stat.mtimeMs) {
      return cached.value;
    }
    const value = JSON.parse(fs.readFileSync(resolved, "utf-8")) as unknown;
    jsonCache.set(filename, { path: resolved, mtimeMs: stat.mtimeMs, value });
    return value;
  } catch (error) {
    diagnostics.push(
      `读取运行时 Source 失败：${filename}（${error instanceof Error ? error.message : String(error)}），已使用内置默认值。`,
    );
    return undefined;
  }
};

export const parseFertilityReportProfileSource = (
  value: unknown,
): FertilityReportProfile => {
  if (!isRecord(value)) return DEFAULT_REPORT_PROFILE;
  const profiles = isRecord(value.profiles) ? value.profiles : {};
  const activeId = cleanId(value.activeProfileId, DEFAULT_REPORT_PROFILE.id);
  const selected = isRecord(profiles[activeId]) ? profiles[activeId] : {};
  const service = isRecord(selected.service) ? selected.service : {};
  const theme = isRecord(selected.theme) ? selected.theme : {};
  return {
    id: activeId,
    brandName: cleanText(service.brandName, DEFAULT_REPORT_PROFILE.brandName, 120),
    teamName: cleanText(service.teamName, DEFAULT_REPORT_PROFILE.teamName, 120),
    serviceLine: cleanText(
      service.serviceLine,
      DEFAULT_REPORT_PROFILE.serviceLine,
      240,
    ),
    footerText: cleanText(
      service.footerText,
      DEFAULT_REPORT_PROFILE.footerText,
      500,
    ),
    deliveryLabel: cleanText(
      service.deliveryLabel,
      DEFAULT_REPORT_PROFILE.deliveryLabel,
      100,
    ),
    theme: {
      primaryColor: cleanColor(
        theme.primaryColor,
        DEFAULT_REPORT_PROFILE.theme.primaryColor,
      ),
      secondaryColor: cleanColor(
        theme.secondaryColor,
        DEFAULT_REPORT_PROFILE.theme.secondaryColor,
      ),
      accentColor: cleanColor(
        theme.accentColor,
        DEFAULT_REPORT_PROFILE.theme.accentColor,
      ),
      softBackground: cleanColor(
        theme.softBackground,
        DEFAULT_REPORT_PROFILE.theme.softBackground,
      ),
      textColor: cleanColor(theme.textColor, DEFAULT_REPORT_PROFILE.theme.textColor),
      mutedTextColor: cleanColor(
        theme.mutedTextColor,
        DEFAULT_REPORT_PROFILE.theme.mutedTextColor,
      ),
    },
  };
};

export const parseFertilityScoringProfileSource = (
  value: unknown,
): FertilityScoringProfile => {
  if (!isRecord(value)) return DEFAULT_SCORING_PROFILE;
  const profiles = isRecord(value.profiles) ? value.profiles : {};
  const activeId = cleanId(value.activeProfileId, DEFAULT_SCORING_PROFILE.id);
  const selected = isRecord(profiles[activeId]) ? profiles[activeId] : {};
  const statusEffect = isRecord(selected.statusEffect) ? selected.statusEffect : {};
  const dimensionsRaw = isRecord(selected.dimensions) ? selected.dimensions : {};
  const dimensions: Record<string, FertilityDimensionCalibration> = {};

  for (const [dimensionId, raw] of Object.entries(dimensionsRaw)) {
    if (!/^(female|male)_[a-z0-9_]+$/i.test(dimensionId) || !isRecord(raw)) continue;
    const criterionWeightsRaw = isRecord(raw.criterionWeights)
      ? raw.criterionWeights
      : {};
    const criterionWeights: Record<string, number> = {};
    for (const [criterionId, weight] of Object.entries(criterionWeightsRaw)) {
      if (!/^[a-z0-9_]{1,80}$/i.test(criterionId)) continue;
      criterionWeights[criterionId] = cleanNumber(weight, 0, 0, 4);
    }
    dimensions[dimensionId] = {
      ...(typeof raw.baseScore === "number"
        ? { baseScore: cleanNumber(raw.baseScore, 5, 0, 10) }
        : {}),
      ...(typeof raw.scoreOffset === "number"
        ? { scoreOffset: cleanNumber(raw.scoreOffset, 0, -3, 3) }
        : {}),
      ...(typeof raw.minScore === "number"
        ? { minScore: cleanNumber(raw.minScore, 0, 0, 10) }
        : {}),
      ...(typeof raw.maxScore === "number"
        ? { maxScore: cleanNumber(raw.maxScore, 10, 0, 10) }
        : {}),
      criterionWeights,
    };
  }

  const mode =
    selected.mode === "recalculate_configured_dimensions"
      ? "recalculate_configured_dimensions"
      : "preserve_builtin";

  return {
    id: activeId,
    version: cleanText(
      selected.version,
      DEFAULT_SCORING_PROFILE.version,
      120,
    ),
    mode,
    noEvidenceReferenceScore: cleanNumber(
      selected.noEvidenceReferenceScore,
      DEFAULT_SCORING_PROFILE.noEvidenceReferenceScore,
      0,
      10,
    ),
    statusEffect: {
      favorable: cleanNumber(
        statusEffect.favorable,
        DEFAULT_SCORING_PROFILE.statusEffect.favorable,
        -4,
        4,
      ),
      neutral: cleanNumber(
        statusEffect.neutral,
        DEFAULT_SCORING_PROFILE.statusEffect.neutral,
        -4,
        4,
      ),
      mild_concern: cleanNumber(
        statusEffect.mild_concern,
        DEFAULT_SCORING_PROFILE.statusEffect.mild_concern,
        -4,
        4,
      ),
      moderate_concern: cleanNumber(
        statusEffect.moderate_concern,
        DEFAULT_SCORING_PROFILE.statusEffect.moderate_concern,
        -4,
        4,
      ),
      high_concern: cleanNumber(
        statusEffect.high_concern,
        DEFAULT_SCORING_PROFILE.statusEffect.high_concern,
        -4,
        4,
      ),
      unknown: cleanNumber(
        statusEffect.unknown,
        DEFAULT_SCORING_PROFILE.statusEffect.unknown,
        -4,
        4,
      ),
    },
    dimensions,
  };
};

export const loadFertilitySourceBundle = (): FertilitySourceBundle => {
  const diagnostics: string[] = [];
  const reportProfile = parseFertilityReportProfileSource(
    readJsonSource("report-profiles.json", diagnostics),
  );
  const scoringProfile = parseFertilityScoringProfileSource(
    readJsonSource("scoring-profiles.json", diagnostics),
  );
  return { reportProfile, scoringProfile, diagnostics };
};
