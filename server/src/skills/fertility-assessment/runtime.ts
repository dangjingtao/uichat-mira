import { collectTaskModelText } from "@/services/task-model.service.js";
import type {
  SkillConversationFlowRuntime,
  SkillDirective,
  SkillFlowRuntimeInput,
  SkillFlowRuntimeResult,
  SkillRequirement,
  StoredSkillFlowSession,
} from "../flow/types.js";
import { toSkillFlowStateRef } from "../flow/state-store.js";

const INITIAL_REQUIREMENT: SkillRequirement = {
  id: "fertility-baseline-context",
  kind: "user_input",
  description:
    "缺少双方的基础备孕背景，包括年龄、备孕时长、妊娠/流产或辅助生殖经历、女方月经与检查、男方精液检查，以及当前最担心的问题。用户可以自由叙述，未知项可以跳过。",
  requiredFor: "建立首轮备孕评估状态并识别后续最高价值信息缺口",
  acceptedFormats: ["natural_language"],
};

const FINAL_CONFIRMATION_REQUIREMENT: SkillRequirement = {
  id: "fertility-final-confirmation",
  kind: "user_input",
  description:
    "需要用户确认是否还有尚未提供但重要的备孕、检查或治疗信息；没有补充时也需要明确确认。",
  requiredFor: "结束信息收集并进入报告生成",
  acceptedFormats: ["natural_language", "explicit_no_more_information"],
};

const FALLBACK_REQUIREMENT: SkillRequirement = {
  id: "fertility-additional-context",
  kind: "user_input",
  description:
    "还缺少可能影响当前备孕计划的关键检查结果、既往妊娠或辅助生殖经历，以及重要生活方式背景。用户只需提供记得的内容，不要求完整或整理成表格。",
  requiredFor: "继续完善备孕评估并判断是否可以进入最终确认",
  acceptedFormats: ["natural_language"],
};

export const FERTILITY_DIMENSION_IDS = [
  "female_endometrium",
  "female_hormonal_balance",
  "female_oocyte_context",
  "female_ovarian_reserve",
  "female_metabolic_health",
  "female_immune_context",
  "female_pelvic_environment",
  "female_nutrition",
  "female_lifestyle",
  "female_sleep_stress",
  "male_dna_integrity",
  "male_morphology",
  "male_motility",
  "male_concentration",
  "male_semen_volume",
  "male_hormonal_balance",
  "male_inflammation",
  "male_nutrition",
  "male_lifestyle",
  "male_sleep_stress",
] as const;

const ALLOWED_DIMENSION_IDS = new Set<string>(FERTILITY_DIMENSION_IDS);
const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const unwrapJsonFence = (value: string) => {
  const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(value);
  return match?.[1] ?? value;
};

const parseJsonObject = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(unwrapJsonFence(value).trim()) as unknown;
  if (!isRecord(parsed)) throw new Error("TaskModel did not return a JSON object");
  return parsed;
};

const mergeRecord = (
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (UNSAFE_OBJECT_KEYS.has(key)) continue;
    if (isRecord(value) && isRecord(next[key])) {
      next[key] = mergeRecord(next[key] as Record<string, unknown>, value);
    } else {
      next[key] = value;
    }
  }
  return next;
};

const uniqueStrings = (values: unknown, limit = 40) =>
  Array.isArray(values)
    ? [
        ...new Set(
          values
            .filter((item): item is string => typeof item === "string")
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ].slice(0, limit)
    : [];

const normalizeUserInputRequirement = (
  value: unknown,
  fallback: SkillRequirement,
): SkillRequirement => {
  if (!isRecord(value)) return fallback;

  const id =
    typeof value.id === "string" && value.id.trim()
      ? value.id.trim().slice(0, 120)
      : fallback.id;
  const description =
    typeof value.description === "string" && value.description.trim()
      ? value.description.trim()
      : fallback.description;
  const requiredFor =
    typeof value.requiredFor === "string" && value.requiredFor.trim()
      ? value.requiredFor.trim()
      : fallback.requiredFor;
  const acceptedFormats = uniqueStrings(value.acceptedFormats, 8);
  const alternatives = uniqueStrings(value.alternatives, 8);

  return {
    id,
    kind: "user_input",
    description,
    requiredFor,
    ...(acceptedFormats.length > 0
      ? { acceptedFormats }
      : fallback.acceptedFormats
        ? { acceptedFormats: [...fallback.acceptedFormats] }
        : {}),
    ...(alternatives.length > 0 ? { alternatives } : {}),
  };
};

export type FertilityDimension = {
  id: string;
  score: number | null;
  confidence: "low" | "medium" | "high";
  dataCompleteness: number;
  evidence: unknown[];
  strengths: string[];
  concerns: string[];
  missingEvidence: string[];
  interpretation: string;
  actions: {
    selfCare: string[];
    discussWithClinician: string[];
    testsToConsider: string[];
  };
};

export type FertilityAssessmentState = {
  facts: Record<string, unknown>;
  missingCriticalFields: string[];
  uncertainties: string[];
  contradictions: string[];
  dimensions: Record<string, FertilityDimension>;
  summary?: {
    strengths: string[];
    priorities: string[];
    visitPrep: string[];
    lifestyleFocus: string[];
  };
  report?: {
    markdown: string;
    html: string;
    generatedAt: string;
  };
};

export const normalizeFertilityDimension = (
  value: unknown,
): FertilityDimension | null => {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const id = value.id.trim();
  if (!ALLOWED_DIMENSION_IDS.has(id)) return null;

  const score =
    typeof value.score === "number" && Number.isFinite(value.score)
      ? Math.max(0, Math.min(10, value.score))
      : null;
  const confidenceRaw = String(value.confidence);
  const confidence: FertilityDimension["confidence"] =
    confidenceRaw === "medium" || confidenceRaw === "high"
      ? confidenceRaw
      : "low";
  const dataCompleteness =
    typeof value.dataCompleteness === "number" && Number.isFinite(value.dataCompleteness)
      ? Math.max(0, Math.min(1, value.dataCompleteness))
      : 0;
  const actions = isRecord(value.actions) ? value.actions : {};

  return {
    id,
    score,
    confidence,
    dataCompleteness,
    evidence: Array.isArray(value.evidence) ? value.evidence.slice(0, 10) : [],
    strengths: uniqueStrings(value.strengths, 8),
    concerns: uniqueStrings(value.concerns, 8),
    missingEvidence: uniqueStrings(value.missingEvidence, 8),
    interpretation:
      typeof value.interpretation === "string" ? value.interpretation.trim() : "",
    actions: {
      selfCare: uniqueStrings(actions.selfCare, 8),
      discussWithClinician: uniqueStrings(actions.discussWithClinician, 8),
      testsToConsider: uniqueStrings(actions.testsToConsider, 8),
    },
  };
};

export const toFertilityAssessmentState = (
  value: Record<string, unknown>,
): FertilityAssessmentState => {
  const dimensions: Record<string, FertilityDimension> = {};
  if (isRecord(value.dimensions)) {
    for (const candidate of Object.values(value.dimensions)) {
      const normalized = normalizeFertilityDimension(candidate);
      if (normalized) dimensions[normalized.id] = normalized;
    }
  }

  return {
    facts: isRecord(value.facts) ? value.facts : {},
    missingCriticalFields: uniqueStrings(value.missingCriticalFields),
    uncertainties: uniqueStrings(value.uncertainties),
    contradictions: uniqueStrings(value.contradictions),
    dimensions,
    ...(isRecord(value.summary)
      ? {
          summary: {
            strengths: uniqueStrings(value.summary.strengths, 8),
            priorities: uniqueStrings(value.summary.priorities, 8),
            visitPrep: uniqueStrings(value.summary.visitPrep, 8),
            lifestyleFocus: uniqueStrings(value.summary.lifestyleFocus, 8),
          },
        }
      : {}),
    ...(isRecord(value.report)
      ? {
          report: {
            markdown:
              typeof value.report.markdown === "string" ? value.report.markdown : "",
            html: typeof value.report.html === "string" ? value.report.html : "",
            generatedAt:
              typeof value.report.generatedAt === "string"
                ? value.report.generatedAt
                : "",
          },
        }
      : {}),
  };
};

const isLikelyActivationOnly = (query: string) => {
  const normalized = query.trim();
  if (normalized.length > 120) return false;
  if (/\d/.test(normalized)) return false;
  return /(?:开始|做|生成|想要|帮我).{0,12}(?:备孕|生育力|生育).{0,12}(?:评估|报告|分析)/i.test(
    normalized,
  );
};

const analysisSystemPrompt = `你是 Mira 的备孕/生育力信息整理 TaskModel。你的职责不是诊断或开处方，而是把用户自由叙述整理成结构化事实，并找出下一步最高价值的外部信息缺口。

硬规则：
1. 只返回 JSON，不要 Markdown。
2. factsPatch 只写本轮明确得到或可安全归一化的事实；不确定内容放 uncertainties。
3. 用户口述化验值一律视为 user_reported，不假装已核验原始报告。
4. 每次最多更新 2 个 dimensions；信息不足时 score 必须为 null，不要制造“精确生育概率”。
5. 允许的 dimension id 只有：${FERTILITY_DIMENSION_IDS.join(", ")}。
6. AMH/AFC 主要反映卵巢储备/促排反应背景，不能单独等同卵子质量或自然受孕概率。
7. 不做疾病诊断，不给处方药方案，不给个体化药物/保健品剂量；建议分 selfCare / discussWithClinician / testsToConsider。
8. 不把免疫、凝血、精子 DNA 碎片等检查当作所有人的常规必查项；没有明确指征时标记为需医生判断。
9. nextRequirement 只描述当前最高价值的缺失信息、它为什么需要以及可接受的输入形式。它不是面向用户的问题，不要写“请问”“能否告诉我”等追问话术。
10. readyForFinalConfirmation 只有在继续收集信息的边际价值已经较低时才为 true。

输出结构：
{
  "factsPatch": {},
  "missingCriticalFields": [],
  "uncertainties": [],
  "contradictions": [],
  "dimensionUpdates": [
    {
      "id": "允许的dimension_id",
      "score": null,
      "confidence": "low|medium|high",
      "dataCompleteness": 0.0,
      "evidence": [{"fact":"...","source":"user_reported"}],
      "strengths": [],
      "concerns": [],
      "missingEvidence": [],
      "interpretation": "",
      "actions": {"selfCare":[],"discussWithClinician":[],"testsToConsider":[]}
    }
  ],
  "readyForFinalConfirmation": false,
  "nextRequirement": {
    "id": "稳定的缺口标识",
    "description": "缺少的业务信息，不写成用户问题",
    "requiredFor": "这项信息影响哪一步判断",
    "acceptedFormats": ["natural_language"]
  }
}`;

const analyzeTurn = async (input: {
  state: FertilityAssessmentState;
  query: string;
  round: number;
}) => {
  const parsed = parseJsonObject(
    await collectTaskModelText(
      [
        { role: "system", content: analysisSystemPrompt, parts: [] },
        {
          role: "user",
          content: JSON.stringify(
            {
              round: input.round,
              currentAssessment: {
                facts: input.state.facts,
                missingCriticalFields: input.state.missingCriticalFields,
                uncertainties: input.state.uncertainties,
                contradictions: input.state.contradictions,
                completedDimensionIds: Object.keys(input.state.dimensions),
              },
              userAnswer: input.query,
            },
            null,
            2,
          ),
          parts: [],
        },
      ],
      {
        maxTokens: 1200,
        temperature: 0,
        purpose: "fertility-assessment-analyze-turn",
      },
    ),
  );

  return {
    factsPatch: isRecord(parsed.factsPatch) ? parsed.factsPatch : {},
    missingCriticalFields: uniqueStrings(parsed.missingCriticalFields),
    uncertainties: uniqueStrings(parsed.uncertainties),
    contradictions: uniqueStrings(parsed.contradictions),
    dimensionUpdates: Array.isArray(parsed.dimensionUpdates)
      ? parsed.dimensionUpdates
          .map(normalizeFertilityDimension)
          .filter((item): item is FertilityDimension => Boolean(item))
          .slice(0, 2)
      : [],
    readyForFinalConfirmation: parsed.readyForFinalConfirmation === true,
    nextRequirement: normalizeUserInputRequirement(
      parsed.nextRequirement,
      FALLBACK_REQUIREMENT,
    ),
  };
};

const withProcessedState = (
  session: StoredSkillFlowSession,
  patch: Partial<StoredSkillFlowSession>,
): StoredSkillFlowSession => ({
  ...session,
  ...patch,
  updatedAt: new Date().toISOString(),
});

const buildDirective = (
  session: StoredSkillFlowSession,
  patch: Omit<SkillDirective, "skillId" | "sessionId" | "stateRef">,
): SkillDirective => ({
  skillId: session.skillId,
  sessionId: session.sessionId,
  stateRef: toSkillFlowStateRef(session),
  ...patch,
});

export const fertilityAssessmentRuntime: SkillConversationFlowRuntime = {
  skillId: "fertility-assessment",
  version: "1.0.0",
  maxRounds: 10,

  createInitialState: () => ({
    facts: {},
    missingCriticalFields: [],
    uncertainties: [],
    contradictions: [],
    dimensions: {},
  }),

  async processTurn(input: SkillFlowRuntimeInput): Promise<SkillFlowRuntimeResult> {
    const currentState = toFertilityAssessmentState(input.session.state);

    if (input.session.round === 0 && isLikelyActivationOnly(input.query)) {
      const directive = buildDirective(input.session, {
        phase: "collecting",
        flowCompleted: false,
        round: 0,
        maxRounds: input.session.maxRounds,
        interruption: {
          reason: "missing_requirement",
          requirements: [INITIAL_REQUIREMENT],
        },
      });
      return {
        session: withProcessedState(input.session, {
          status: "collecting",
          lastDirective: directive,
        }),
        directive,
      };
    }

    let analysis: Awaited<ReturnType<typeof analyzeTurn>>;
    try {
      analysis = await analyzeTurn({
        state: currentState,
        query: input.query,
        round: input.session.round + 1,
      });
    } catch {
      analysis = {
        factsPatch: {},
        missingCriticalFields: currentState.missingCriticalFields,
        uncertainties: currentState.uncertainties,
        contradictions: currentState.contradictions,
        dimensionUpdates: [],
        readyForFinalConfirmation: false,
        nextRequirement: FALLBACK_REQUIREMENT,
      };
    }

    const dimensions = { ...currentState.dimensions };
    for (const item of analysis.dimensionUpdates) dimensions[item.id] = item;

    const nextRound = input.session.round + 1;
    const nextState: FertilityAssessmentState = {
      ...currentState,
      facts: mergeRecord(currentState.facts, analysis.factsPatch),
      missingCriticalFields: analysis.missingCriticalFields,
      uncertainties: analysis.uncertainties,
      contradictions: analysis.contradictions,
      dimensions,
    };

    if (input.session.status === "final_confirmation") {
      const readySession = withProcessedState(input.session, {
        status: "ready",
        round: nextRound,
        state: nextState as unknown as Record<string, unknown>,
      });
      const directive = buildDirective(readySession, {
        phase: "ready",
        flowCompleted: true,
        round: nextRound,
        maxRounds: input.session.maxRounds,
        next: {
          intent: "generate_report",
          targetSkillId: "fertility-report",
          args: {
            assessmentRef: toSkillFlowStateRef(readySession),
            reportType: "couple",
            format: "markdown",
            includeFemale: true,
            includeMale: true,
            htmlAvailable: true,
          },
        },
      });
      return {
        session: { ...readySession, lastDirective: directive },
        directive,
      };
    }

    const shouldConfirm =
      analysis.readyForFinalConfirmation || nextRound >= input.session.maxRounds;
    const nextSession = withProcessedState(input.session, {
      status: shouldConfirm ? "final_confirmation" : "collecting",
      round: nextRound,
      state: nextState as unknown as Record<string, unknown>,
    });
    const directive = buildDirective(nextSession, {
      phase: shouldConfirm ? "final_confirmation" : "collecting",
      flowCompleted: false,
      round: nextRound,
      maxRounds: input.session.maxRounds,
      interruption: {
        reason: "missing_requirement",
        requirements: [
          shouldConfirm ? FINAL_CONFIRMATION_REQUIREMENT : analysis.nextRequirement,
        ],
      },
    });

    return {
      session: { ...nextSession, lastDirective: directive },
      directive,
    };
  },
};
