import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import type {
  SkillConversationFlowRuntime,
  SkillDirective,
  SkillFlowRuntimeInput,
  SkillFlowRuntimeResult,
  StoredSkillFlowSession,
} from "../flow/types.js";
import { toSkillFlowStateRef } from "../flow/state-store.js";

const FIRST_QUESTION =
  "先把你们目前的情况尽量告诉我：双方年龄、备孕多久、有没有怀孕/流产或试管经历、女方月经和做过的检查、男方有没有精液检查，以及你们现在最担心什么。记得多少说多少，不用整理，不知道的直接跳过。";
const FINAL_CONFIRMATION_QUESTION =
  "我基本了解完整了。还有什么你觉得很重要、但我一直没问到的吗？没有的话直接告诉我“没有了”就可以。";

const SAFE_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);

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

const collectTaskText = async (messages: NormalizedChatMessage[]) => {
  let output = "";
  for await (const delta of providerProxyService.streamTaskChatText(messages)) {
    output += delta;
  }
  return output.trim();
};

const mergeRecord = (
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (SAFE_OBJECT_KEYS.has(key)) continue;
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
  rawTurnNotes: string[];
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
  if (!isRecord(value) || typeof value.id !== "string" || !value.id.trim()) return null;
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
    id: value.id.trim(),
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
    for (const [id, candidate] of Object.entries(value.dimensions)) {
      const normalized = normalizeFertilityDimension(candidate);
      if (normalized) dimensions[id] = normalized;
    }
  }

  return {
    facts: isRecord(value.facts) ? value.facts : {},
    missingCriticalFields: uniqueStrings(value.missingCriticalFields),
    uncertainties: uniqueStrings(value.uncertainties),
    contradictions: uniqueStrings(value.contradictions),
    dimensions,
    rawTurnNotes: uniqueStrings(value.rawTurnNotes, 30),
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

const analysisSystemPrompt = `你是 Mira 的备孕/生育力信息整理 TaskModel。你的职责不是诊断或开处方，而是把用户自由叙述整理成结构化事实，并为下一轮访谈寻找最高价值的信息缺口。

硬规则：
1. 只返回 JSON，不要 Markdown。
2. factsPatch 只写本轮明确得到或可安全归一化的事实；不确定内容放 uncertainties。
3. 用户口述化验值一律视为 user_reported，不假装已核验原始报告。
4. 每次最多更新 2 个 dimensions；信息不足时 score 必须为 null，不要制造“精确生育概率”。
5. AMH/AFC 主要反映卵巢储备/促排反应背景，不能单独等同卵子质量或自然受孕概率。
6. 不做疾病诊断，不给处方药方案，不给个体化药物/保健品剂量；建议分 selfCare / discussWithClinician / testsToConsider。
7. 不把免疫、凝血、精子 DNA 碎片等检查当作所有人的常规必查项；没有明确指征时标记为需医生判断。
8. nextQuestion 只问一轮里最值得问的一组相关信息，语言自然，不要像表格审讯。
9. readyForFinalConfirmation 只有在继续追问的边际价值已经较低时才为 true。

输出结构：
{
  "factsPatch": {},
  "missingCriticalFields": [],
  "uncertainties": [],
  "contradictions": [],
  "dimensionUpdates": [
    {
      "id": "dimension_id",
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
  "nextQuestion": ""
}`;

const analyzeTurn = async (input: {
  state: FertilityAssessmentState;
  query: string;
  round: number;
}) => {
  const parsed = parseJsonObject(
    await collectTaskText([
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
    ]),
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
    nextQuestion:
      typeof parsed.nextQuestion === "string" && parsed.nextQuestion.trim()
        ? parsed.nextQuestion.trim()
        : "还有哪些你记得的检查结果、治疗经历或生活习惯，可能会影响你们现在的备孕计划？",
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
    rawTurnNotes: [],
  }),

  async processTurn(input: SkillFlowRuntimeInput): Promise<SkillFlowRuntimeResult> {
    const currentState = toFertilityAssessmentState(input.session.state);

    if (input.session.round === 0 && isLikelyActivationOnly(input.query)) {
      const directive = buildDirective(input.session, {
        phase: "collecting",
        flowCompleted: false,
        round: 0,
        maxRounds: input.session.maxRounds,
        requiredAction: "ask_user",
        question: FIRST_QUESTION,
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
        nextQuestion:
          "你可以继续把记得的检查结果、既往怀孕或试管经历告诉我，数字不必整理得很完美；我会自己归类。",
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
      rawTurnNotes: [...currentState.rawTurnNotes, input.query].slice(-30),
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
      requiredAction: "ask_user",
      question: shouldConfirm ? FINAL_CONFIRMATION_QUESTION : analysis.nextQuestion,
    });

    return {
      session: { ...nextSession, lastDirective: directive },
      directive,
    };
  },
};
