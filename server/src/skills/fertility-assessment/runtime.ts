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

const FEMALE_DIMENSIONS = [
  ["female_endometrium", "子宫内膜与宫腔"],
  ["female_hormonal_balance", "激素与排卵"],
  ["female_oocyte_context", "卵子相关背景"],
  ["female_ovarian_reserve", "卵巢储备"],
  ["female_metabolic_health", "代谢健康"],
  ["female_immune_context", "免疫相关背景"],
  ["female_pelvic_environment", "盆腔与输卵管环境"],
  ["female_nutrition", "营养状况"],
  ["female_lifestyle", "生活方式"],
  ["female_sleep_stress", "睡眠、压力与情绪"],
] as const;

const MALE_DIMENSIONS = [
  ["male_dna_integrity", "精子 DNA 完整性相关背景"],
  ["male_morphology", "精子形态"],
  ["male_motility", "精子活力"],
  ["male_concentration", "精子浓度与总数"],
  ["male_semen_volume", "精液量与基础参数"],
  ["male_hormonal_balance", "男性激素相关背景"],
  ["male_inflammation", "炎症与泌尿生殖系统背景"],
  ["male_nutrition", "营养状况"],
  ["male_lifestyle", "生活方式"],
  ["male_sleep_stress", "睡眠、压力与情绪"],
] as const;

const ALL_DIMENSIONS = [...FEMALE_DIMENSIONS, ...MALE_DIMENSIONS] as const;
const FIRST_QUESTION =
  "先把你们目前的情况尽量告诉我：双方年龄、备孕多久、有没有怀孕/流产或试管经历、女方月经和做过的检查、男方有没有精液检查，以及你们现在最担心什么。记得多少说多少，不用整理，不知道的直接跳过。";
const FINAL_CONFIRMATION_QUESTION =
  "我基本了解完整了。还有什么你觉得很重要、但我一直没问到的吗？没有的话直接告诉我“没有了”就可以。";

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
    ? [...new Set(values.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, limit)
    : [];

const normalizeDimension = (value: unknown) => {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const score =
    typeof value.score === "number" && Number.isFinite(value.score)
      ? Math.max(0, Math.min(10, value.score))
      : null;
  const confidence = ["low", "medium", "high"].includes(String(value.confidence))
    ? String(value.confidence)
    : "low";
  const dataCompleteness =
    typeof value.dataCompleteness === "number" && Number.isFinite(value.dataCompleteness)
      ? Math.max(0, Math.min(1, value.dataCompleteness))
      : 0;
  const actions = isRecord(value.actions) ? value.actions : {};
  return {
    id: value.id,
    score,
    confidence,
    dataCompleteness,
    evidence: Array.isArray(value.evidence) ? value.evidence.slice(0, 10) : [],
    strengths: uniqueStrings(value.strengths, 8),
    concerns: uniqueStrings(value.concerns, 8),
    missingEvidence: uniqueStrings(value.missingEvidence, 8),
    interpretation: typeof value.interpretation === "string" ? value.interpretation.trim() : "",
    actions: {
      selfCare: uniqueStrings(actions.selfCare, 8),
      discussWithClinician: uniqueStrings(actions.discussWithClinician, 8),
      testsToConsider: uniqueStrings(actions.testsToConsider, 8),
    },
  };
};

type FertilityAssessmentState = {
  facts: Record<string, unknown>;
  missingCriticalFields: string[];
  uncertainties: string[];
  contradictions: string[];
  dimensions: Record<string, ReturnType<typeof normalizeDimension>>;
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

const toAssessmentState = (value: Record<string, unknown>): FertilityAssessmentState => ({
  facts: isRecord(value.facts) ? value.facts : {},
  missingCriticalFields: uniqueStrings(value.missingCriticalFields),
  uncertainties: uniqueStrings(value.uncertainties),
  contradictions: uniqueStrings(value.contradictions),
  dimensions: isRecord(value.dimensions)
    ? (value.dimensions as FertilityAssessmentState["dimensions"])
    : {},
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
          markdown: typeof value.report.markdown === "string" ? value.report.markdown : "",
          html: typeof value.report.html === "string" ? value.report.html : "",
          generatedAt: typeof value.report.generatedAt === "string" ? value.report.generatedAt : "",
        },
      }
    : {}),
});

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
  const messages: NormalizedChatMessage[] = [
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
  ];
  const parsed = parseJsonObject(await collectTaskText(messages));
  return {
    factsPatch: isRecord(parsed.factsPatch) ? parsed.factsPatch : {},
    missingCriticalFields: uniqueStrings(parsed.missingCriticalFields),
    uncertainties: uniqueStrings(parsed.uncertainties),
    contradictions: uniqueStrings(parsed.contradictions),
    dimensionUpdates: Array.isArray(parsed.dimensionUpdates)
      ? parsed.dimensionUpdates.map(normalizeDimension).filter(Boolean).slice(0, 2)
      : [],
    readyForFinalConfirmation: parsed.readyForFinalConfirmation === true,
    nextQuestion:
      typeof parsed.nextQuestion === "string" && parsed.nextQuestion.trim()
        ? parsed.nextQuestion.trim()
        : "还有哪些你记得的检查结果、治疗经历或生活习惯，可能会影响你们现在的备孕计划？",
  };
};

const dimensionPrompt = (dimensionPairs: ReadonlyArray<readonly [string, string]>) =>
  `你是 Mira 备孕全景报告的维度分析 TaskModel。只分析指定的 1~2 个维度，只返回 JSON 数组。\n\n指定维度：${dimensionPairs
    .map(([id, label]) => `${id}=${label}`)
    .join("；")}\n\n规则：\n- 仅根据提供的 facts，不补造检查结果。\n- score 是 0~10 的启发式状态分，不是怀孕概率；证据不足必须为 null。\n- 必须给 confidence 和 dataCompleteness。\n- 区分 evidence / concerns / missingEvidence。\n- 不诊断、不处方、不输出个体化药物或补充剂剂量。\n- testsToConsider 必须写成“与生殖/男科医生讨论是否需要”，不能写成人人必查。\n- 卵子质量不能被 AMH 直接测量；年龄、胚胎学和既往 ART 结果只能作为背景证据。\n\n每项结构：{id,score,confidence,dataCompleteness,evidence,strengths,concerns,missingEvidence,interpretation,actions:{selfCare,discussWithClinician,testsToConsider}}`;

const completeDimensions = async (state: FertilityAssessmentState) => {
  const nextDimensions = { ...state.dimensions };
  const pending = ALL_DIMENSIONS.filter(([id]) => !nextDimensions[id]);
  for (let index = 0; index < pending.length; index += 2) {
    const batch = pending.slice(index, index + 2);
    try {
      const output = await collectTaskText([
        { role: "system", content: dimensionPrompt(batch), parts: [] },
        {
          role: "user",
          content: JSON.stringify({ facts: state.facts }, null, 2),
          parts: [],
        },
      ]);
      const parsed = JSON.parse(unwrapJsonFence(output).trim()) as unknown;
      if (!Array.isArray(parsed)) continue;
      for (const item of parsed) {
        const normalized = normalizeDimension(item);
        if (normalized && batch.some(([id]) => id === normalized.id)) {
          nextDimensions[normalized.id] = normalized;
        }
      }
    } catch {
      // A failed dimension subcall must not discard the interview. Missing
      // dimensions are rendered as insufficient-data sections below.
    }
  }

  for (const [id] of ALL_DIMENSIONS) {
    if (!nextDimensions[id]) {
      nextDimensions[id] = {
        id,
        score: null,
        confidence: "low",
        dataCompleteness: 0,
        evidence: [],
        strengths: [],
        concerns: [],
        missingEvidence: ["当前对话信息不足，无法形成可靠维度判断"],
        interpretation: "信息不足，建议在后续就诊或补充资料后再更新本维度。",
        actions: { selfCare: [], discussWithClinician: [], testsToConsider: [] },
      };
    }
  }

  return nextDimensions;
};

const buildSummary = async (state: FertilityAssessmentState) => {
  try {
    const output = await collectTaskText([
      {
        role: "system",
        content:
          "你是 Mira 备孕全景报告的汇总 TaskModel。只返回 JSON：{strengths:string[],priorities:string[],visitPrep:string[],lifestyleFocus:string[]}。每组最多6条。只根据给定 facts 和 dimensions；不诊断、不处方、不写个体化药物或补充剂剂量。把需要医疗决策的内容写成与生殖科/男科医生讨论的问题。",
        parts: [],
      },
      {
        role: "user",
        content: JSON.stringify({ facts: state.facts, dimensions: state.dimensions }, null, 2),
        parts: [],
      },
    ]);
    const parsed = parseJsonObject(output);
    return {
      strengths: uniqueStrings(parsed.strengths, 6),
      priorities: uniqueStrings(parsed.priorities, 6),
      visitPrep: uniqueStrings(parsed.visitPrep, 6),
      lifestyleFocus: uniqueStrings(parsed.lifestyleFocus, 6),
    };
  } catch {
    return {
      strengths: [],
      priorities: state.missingCriticalFields.slice(0, 6),
      visitPrep: ["把关键检查结果、既往治疗时间线和当前用药/补充剂清单带给生殖专科医生核对"],
      lifestyleFocus: [],
    };
  }
};

const dimensionLabel = (id: string) =>
  ALL_DIMENSIONS.find(([candidate]) => candidate === id)?.[1] ?? id;

const formatScore = (score: unknown) =>
  typeof score === "number" ? `${score.toFixed(1)} / 10` : "信息不足，暂不评分";

const renderList = (items: unknown) => {
  const values = uniqueStrings(items, 12);
  return values.length > 0 ? values.map((item) => `- ${item}`).join("\n") : "- 暂无足够信息";
};

const renderMarkdownReport = (state: FertilityAssessmentState) => {
  const generatedAt = new Date().toISOString();
  const female = FEMALE_DIMENSIONS.map(([id]) => state.dimensions[id]).filter(Boolean);
  const male = MALE_DIMENSIONS.map(([id]) => state.dimensions[id]).filter(Boolean);
  const renderDimension = (dimension: NonNullable<(typeof female)[number]>) => `### ${dimensionLabel(dimension.id)}\n\n**状态分：${formatScore(dimension.score)}｜置信度：${dimension.confidence}｜资料完整度：${Math.round(dimension.dataCompleteness * 100)}%**\n\n${dimension.interpretation || "当前信息不足，暂不做进一步解释。"}\n\n**已有依据**\n${renderList((dimension.evidence ?? []).map((item) => (isRecord(item) && typeof item.fact === "string" ? item.fact : "")).filter(Boolean))}\n\n**需要关注**\n${renderList(dimension.concerns)}\n\n**还缺什么**\n${renderList(dimension.missingEvidence)}\n\n**可以自己先做的事**\n${renderList(dimension.actions.selfCare)}\n\n**建议和医生讨论**\n${renderList(dimension.actions.discussWithClinician)}\n`;

  return `# 两个人的备孕全景报告\n\n> 生成时间：${generatedAt}\n> 本报告基于当前对话中用户主动提供的信息生成，未核验原始检查单，仅用于健康教育、信息整理和就诊准备，不构成诊断、处方或替代生殖专科医生的医疗决策。\n\n## 先看结论\n\n### 当前优势\n${renderList(state.summary?.strengths)}\n\n### 当前优先事项\n${renderList(state.summary?.priorities)}\n\n### 下次就诊最值得带着问的问题\n${renderList(state.summary?.visitPrep)}\n\n### 生活方式优先级\n${renderList(state.summary?.lifestyleFocus)}\n\n## 女方十维画像\n\n${female.map((item) => renderDimension(item!)).join("\n---\n\n")}\n\n## 男方十维画像\n\n${male.map((item) => renderDimension(item!)).join("\n---\n\n")}\n\n## 资料缺口与不确定项\n\n### 关键缺口\n${renderList(state.missingCriticalFields)}\n\n### 尚未确认\n${renderList(state.uncertainties)}\n\n### 前后可能矛盾\n${renderList(state.contradictions)}\n\n---\n\n**重要说明**：分数只是为了帮助阅读和排序的启发式状态表达，不是怀孕概率，也不能替代年龄、病史、影像、化验、精液分析和医生面诊的综合判断。对于异常出血、剧烈腹痛、严重感染症状、妊娠相关急症或其他紧急情况，应及时线下就医。\n`;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);

const renderHtmlReport = (state: FertilityAssessmentState) => {
  const cards = ALL_DIMENSIONS.map(([id, label]) => {
    const item = state.dimensions[id];
    if (!item) return "";
    return `<section class="dimension"><div class="dimension-head"><h3>${escapeHtml(label)}</h3><span>${escapeHtml(formatScore(item.score))}</span></div><div class="meta">置信度 ${escapeHtml(item.confidence)} · 资料完整度 ${Math.round(item.dataCompleteness * 100)}%</div><p>${escapeHtml(item.interpretation || "当前信息不足，暂不做进一步解释。")}</p></section>`;
  }).join("\n");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>两个人的备孕全景报告</title><style>body{margin:0;background:#f5f3ef;color:#282522;font-family:Inter,"Noto Sans SC",system-ui,sans-serif}.page{max-width:960px;margin:36px auto;background:white;padding:52px;border-radius:24px;box-shadow:0 18px 60px rgba(49,41,34,.08)}h1{font-size:34px;margin:0 0 8px}.sub{color:#766e67;margin-bottom:32px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.dimension{border:1px solid #e7e0d9;border-radius:16px;padding:18px}.dimension-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.dimension-head h3{font-size:17px;margin:0}.dimension-head span{white-space:nowrap;font-weight:650}.meta{font-size:12px;color:#8a8179;margin:8px 0 12px}.dimension p{line-height:1.7;margin:0;color:#514a45}.note{margin-top:28px;padding:18px;border-radius:14px;background:#faf7f2;color:#665e57;line-height:1.7}@media(max-width:720px){.page{margin:0;padding:28px;border-radius:0}.grid{grid-template-columns:1fr}}@media print{body{background:white}.page{box-shadow:none;margin:0;max-width:none}}</style></head><body><main class="page"><h1>两个人的备孕全景报告</h1><div class="sub">基于对话信息生成 · 健康教育 / 信息整理 / 就诊准备</div><div class="grid">${cards}</div><div class="note">本报告未核验原始检查单，不构成诊断、处方或替代生殖专科医生的医疗决策。维度分数仅用于阅读和优先级排序，不代表怀孕概率。</div></main></body></html>`;
};

const finalizeReport = async (state: FertilityAssessmentState) => {
  const dimensions = await completeDimensions(state);
  const withDimensions: FertilityAssessmentState = { ...state, dimensions };
  const summary = await buildSummary(withDimensions);
  const readyState: FertilityAssessmentState = { ...withDimensions, summary };
  const generatedAt = new Date().toISOString();
  const report = {
    markdown: renderMarkdownReport(readyState),
    html: renderHtmlReport(readyState),
    generatedAt,
  };
  return { ...readyState, report };
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
    const currentState = toAssessmentState(input.session.state);

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
    for (const item of analysis.dimensionUpdates) {
      if (item) dimensions[item.id] = item;
    }
    const nextRound = input.session.round + 1;
    let nextState: FertilityAssessmentState = {
      ...currentState,
      facts: mergeRecord(currentState.facts, analysis.factsPatch),
      missingCriticalFields: analysis.missingCriticalFields,
      uncertainties: analysis.uncertainties,
      contradictions: analysis.contradictions,
      dimensions,
      rawTurnNotes: [...currentState.rawTurnNotes, input.query].slice(-30),
    };

    if (input.session.status === "final_confirmation") {
      nextState = await finalizeReport(nextState);
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
            htmlAvailable: true,
          },
        },
        delivery: {
          kind: "markdown",
          content: nextState.report?.markdown ?? "报告生成失败，请稍后重试。",
        },
      });
      return {
        session: { ...readySession, lastDirective: directive },
        directive,
      };
    }

    const shouldConfirm = analysis.readyForFinalConfirmation || nextRound >= input.session.maxRounds;
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
