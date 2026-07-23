import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import {
  normalizeFertilityDimension,
  toFertilityAssessmentState,
  type FertilityAssessmentState,
  type FertilityDimension,
} from "../fertility-assessment/runtime.js";
import { toSkillFlowStateRef } from "../flow/state-store.js";
import type {
  SkillDirective,
  SkillDirectiveHandoffRuntime,
  StoredSkillFlowSession,
} from "../flow/types.js";

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
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

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

const uniqueStrings = (values: unknown, limit = 12) =>
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

const dimensionPrompt = (dimensionPairs: ReadonlyArray<readonly [string, string]>) =>
  `你是 Mira 备孕全景报告的维度分析 TaskModel。只分析指定的 1~2 个维度，只返回 JSON 数组。

指定维度：${dimensionPairs.map(([id, label]) => `${id}=${label}`).join("；")}

规则：
- 仅根据提供的 facts，不补造检查结果。
- score 是 0~10 的启发式状态分，不是怀孕概率；证据不足必须为 null。
- 必须给 confidence 和 dataCompleteness。
- 区分 evidence / concerns / missingEvidence。
- 不诊断、不处方、不输出个体化药物或补充剂剂量。
- testsToConsider 必须写成“与生殖科/男科医生讨论是否需要”，不能写成人人必查。
- AMH/AFC 主要反映卵巢储备背景，不能单独等同自然受孕概率。
- 卵子质量不能被 AMH 直接测量；年龄、胚胎学和既往 ART 结果只能作为背景证据。

每项结构：{id,score,confidence,dataCompleteness,evidence,strengths,concerns,missingEvidence,interpretation,actions:{selfCare,discussWithClinician,testsToConsider}}`;

const completeDimensions = async (state: FertilityAssessmentState) => {
  const dimensions: Record<string, FertilityDimension> = { ...state.dimensions };
  const pending = ALL_DIMENSIONS.filter(([id]) => !dimensions[id]);

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
      for (const candidate of parsed) {
        const normalized = normalizeFertilityDimension(candidate);
        if (
          normalized &&
          batch.some(([dimensionId]) => dimensionId === normalized.id)
        ) {
          dimensions[normalized.id] = normalized;
        }
      }
    } catch {
      // One failed 1~2 dimension TaskModel call must not invalidate the whole
      // assessment. Missing dimensions are represented explicitly below.
    }
  }

  for (const [id] of ALL_DIMENSIONS) {
    if (dimensions[id]) continue;
    dimensions[id] = {
      id,
      score: null,
      confidence: "low",
      dataCompleteness: 0,
      evidence: [],
      strengths: [],
      concerns: [],
      missingEvidence: ["当前对话信息不足，无法形成可靠维度判断"],
      interpretation: "信息不足，建议在后续就诊或补充资料后再更新本维度。",
      actions: {
        selfCare: [],
        discussWithClinician: [],
        testsToConsider: [],
      },
    };
  }

  return dimensions;
};

const buildSummary = async (state: FertilityAssessmentState) => {
  try {
    const parsed = parseJsonObject(
      await collectTaskText([
        {
          role: "system",
          content:
            "你是 Mira 备孕全景报告的汇总 TaskModel。只返回 JSON：{strengths:string[],priorities:string[],visitPrep:string[],lifestyleFocus:string[]}。每组最多6条。只根据给定 facts 和 dimensions；不诊断、不处方、不写个体化药物或补充剂剂量。把需要医疗决策的内容写成与生殖科/男科医生讨论的问题。",
          parts: [],
        },
        {
          role: "user",
          content: JSON.stringify(
            { facts: state.facts, dimensions: state.dimensions },
            null,
            2,
          ),
          parts: [],
        },
      ]),
    );
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
      visitPrep: [
        "把关键检查结果、既往治疗时间线和当前用药/补充剂清单带给生殖专科医生核对",
      ],
      lifestyleFocus: [],
    };
  }
};

const dimensionLabel = (id: string) =>
  ALL_DIMENSIONS.find(([candidate]) => candidate === id)?.[1] ?? id;

const formatScore = (score: number | null) =>
  typeof score === "number" ? `${score.toFixed(1)} / 10` : "信息不足，暂不评分";

const renderList = (items: unknown) => {
  const values = uniqueStrings(items, 12);
  return values.length > 0
    ? values.map((item) => `- ${item}`).join("\n")
    : "- 暂无足够信息";
};

const renderDimensionMarkdown = (dimension: FertilityDimension) => {
  const evidenceFacts = dimension.evidence
    .map((item) =>
      isRecord(item) && typeof item.fact === "string" ? item.fact : "",
    )
    .filter(Boolean);
  return `### ${dimensionLabel(dimension.id)}

**状态分：${formatScore(dimension.score)}｜置信度：${dimension.confidence}｜资料完整度：${Math.round(dimension.dataCompleteness * 100)}%**

${dimension.interpretation || "当前信息不足，暂不做进一步解释。"}

**已有依据**
${renderList(evidenceFacts)}

**需要关注**
${renderList(dimension.concerns)}

**还缺什么**
${renderList(dimension.missingEvidence)}

**可以自己先做的事**
${renderList(dimension.actions.selfCare)}

**建议和医生讨论**
${renderList(dimension.actions.discussWithClinician)}
`;
};

const renderMarkdownReport = (state: FertilityAssessmentState) => {
  const generatedAt = new Date().toISOString();
  const female = FEMALE_DIMENSIONS.map(([id]) => state.dimensions[id]).filter(
    (item): item is FertilityDimension => Boolean(item),
  );
  const male = MALE_DIMENSIONS.map(([id]) => state.dimensions[id]).filter(
    (item): item is FertilityDimension => Boolean(item),
  );

  return `# 两个人的备孕全景报告

> 生成时间：${generatedAt}
> 本报告基于当前对话中用户主动提供的信息生成，未核验原始检查单，仅用于健康教育、信息整理和就诊准备，不构成诊断、处方或替代生殖专科医生的医疗决策。

## 先看结论

### 当前优势
${renderList(state.summary?.strengths)}

### 当前优先事项
${renderList(state.summary?.priorities)}

### 下次就诊最值得带着问的问题
${renderList(state.summary?.visitPrep)}

### 生活方式优先级
${renderList(state.summary?.lifestyleFocus)}

## 女方十维画像

${female.map(renderDimensionMarkdown).join("\n---\n\n")}

## 男方十维画像

${male.map(renderDimensionMarkdown).join("\n---\n\n")}

## 资料缺口与不确定项

### 关键缺口
${renderList(state.missingCriticalFields)}

### 尚未确认
${renderList(state.uncertainties)}

### 前后可能矛盾
${renderList(state.contradictions)}

---

**重要说明**：分数只是为了帮助阅读和排序的启发式状态表达，不是怀孕概率，也不能替代年龄、病史、影像、化验、精液分析和医生面诊的综合判断。对于异常出血、剧烈腹痛、严重感染症状、妊娠相关急症或其他紧急情况，应及时线下就医。
`;
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

const renderHtmlReport = (state: FertilityAssessmentState) => {
  const cards = ALL_DIMENSIONS.map(([id, label]) => {
    const item = state.dimensions[id];
    if (!item) return "";
    return `<section class="dimension"><div class="dimension-head"><h3>${escapeHtml(label)}</h3><span>${escapeHtml(formatScore(item.score))}</span></div><div class="meta">置信度 ${escapeHtml(item.confidence)} · 资料完整度 ${Math.round(item.dataCompleteness * 100)}%</div><p>${escapeHtml(item.interpretation || "当前信息不足，暂不做进一步解释。")}</p></section>`;
  }).join("\n");

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>两个人的备孕全景报告</title><style>body{margin:0;background:#f5f3ef;color:#282522;font-family:Inter,"Noto Sans SC",system-ui,sans-serif}.page{max-width:960px;margin:36px auto;background:white;padding:52px;border-radius:24px;box-shadow:0 18px 60px rgba(49,41,34,.08)}h1{font-size:34px;margin:0 0 8px}.sub{color:#766e67;margin-bottom:32px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.dimension{border:1px solid #e7e0d9;border-radius:16px;padding:18px}.dimension-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.dimension-head h3{font-size:17px;margin:0}.dimension-head span{white-space:nowrap;font-weight:650}.meta{font-size:12px;color:#8a8179;margin:8px 0 12px}.dimension p{line-height:1.7;margin:0;color:#514a45}.note{margin-top:28px;padding:18px;border-radius:14px;background:#faf7f2;color:#665e57;line-height:1.7}@media(max-width:720px){.page{margin:0;padding:28px;border-radius:0}.grid{grid-template-columns:1fr}}@media print{body{background:white}.page{box-shadow:none;margin:0;max-width:none}}</style></head><body><main class="page"><h1>两个人的备孕全景报告</h1><div class="sub">基于对话信息生成 · 健康教育 / 信息整理 / 就诊准备</div><div class="grid">${cards}</div><div class="note">本报告未核验原始检查单，不构成诊断、处方或替代生殖专科医生的医疗决策。维度分数仅用于阅读和优先级排序，不代表怀孕概率。</div></main></body></html>`;
};

const withUpdatedState = (
  session: StoredSkillFlowSession,
  state: FertilityAssessmentState,
): StoredSkillFlowSession => ({
  ...session,
  status: "ready",
  state: state as unknown as Record<string, unknown>,
  updatedAt: new Date().toISOString(),
});

export const fertilityReportRuntime: SkillDirectiveHandoffRuntime = {
  skillId: "fertility-report",
  version: "1.0.0",

  async execute({ session, sourceDirective, args }) {
    const stateRef = toSkillFlowStateRef(session);
    if (
      typeof args.assessmentRef === "string" &&
      args.assessmentRef.trim() &&
      args.assessmentRef !== stateRef
    ) {
      throw new Error("fertility-report assessmentRef does not match active Skill state");
    }

    const assessment = toFertilityAssessmentState(session.state);
    const dimensions = await completeDimensions(assessment);
    const withDimensions: FertilityAssessmentState = {
      ...assessment,
      dimensions,
    };
    const summary = await buildSummary(withDimensions);
    const reportState: FertilityAssessmentState = {
      ...withDimensions,
      summary,
    };
    const generatedAt = new Date().toISOString();
    reportState.report = {
      markdown: renderMarkdownReport(reportState),
      html: renderHtmlReport(reportState),
      generatedAt,
    };

    const nextSession = withUpdatedState(session, reportState);
    const directive: SkillDirective = {
      skillId: "fertility-report",
      sessionId: session.sessionId,
      phase: "ready",
      flowCompleted: true,
      round: sourceDirective.round,
      maxRounds: sourceDirective.maxRounds,
      stateRef,
      next: {
        intent: "deliver_report",
        targetSkillId: "fertility-report",
        args: {
          assessmentRef: stateRef,
          reportType: args.reportType ?? "couple",
          format: args.format ?? "markdown",
          htmlAvailable: true,
        },
      },
      delivery: {
        kind: "markdown",
        content: reportState.report.markdown,
      },
    };

    return {
      session: { ...nextSession, lastDirective: directive },
      directive,
    };
  },
};
