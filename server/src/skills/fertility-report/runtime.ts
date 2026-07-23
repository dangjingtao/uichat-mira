import { writeStructuredLog } from "@/logger";
import { collectTaskModelText } from "@/services/task-model.service.js";
import {
  normalizeFertilityDimension,
  toFertilityAssessmentState,
  type FertilityAssessmentState,
  type FertilityDimension,
} from "../fertility-assessment/runtime.js";
import { renderHtmlReportToPdf } from "../flow/html-to-pdf.js";
import {
  resolveSkillReportPdfPath,
  writeSkillReportHtml,
} from "../flow/report-files.js";
import { toSkillFlowStateRef } from "../flow/state-store.js";
import type {
  SkillDirective,
  SkillDirectiveHandoffRuntime,
  StoredSkillFlowSession,
} from "../flow/types.js";

const REPORT_TITLE = "两个人的备孕全景报告";
const REPORT_PDF_FILENAME = `${REPORT_TITLE}.pdf`;

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

  for (let index = 0; index < ALL_DIMENSIONS.length; index += 2) {
    const batch = ALL_DIMENSIONS.slice(index, index + 2);
    try {
      const output = await collectTaskModelText(
        [
          { role: "system", content: dimensionPrompt(batch), parts: [] },
          {
            role: "user",
            content: JSON.stringify({ facts: state.facts }, null, 2),
            parts: [],
          },
        ],
        {
          maxTokens: 1200,
          temperature: 0,
          purpose: `fertility-report-dimensions:${batch.map(([id]) => id).join(",")}`,
        },
      );
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
      // Keep any interview draft. One failed bounded subcall must not lose the
      // whole report; missing dimensions are represented explicitly below.
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
      await collectTaskModelText(
        [
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
        ],
        { maxTokens: 700, temperature: 0, purpose: "fertility-report-summary" },
      ),
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

  return `# ${REPORT_TITLE}

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

const renderHtmlList = (items: unknown, empty = "暂无足够信息") => {
  const values = uniqueStrings(items, 12);
  if (values.length === 0) return `<div class="empty">${escapeHtml(empty)}</div>`;
  return `<ul>${values.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
};

const renderEvidenceList = (dimension: FertilityDimension) => {
  const values = dimension.evidence
    .map((item) =>
      isRecord(item) && typeof item.fact === "string" ? item.fact.trim() : "",
    )
    .filter(Boolean)
    .slice(0, 10);
  return renderHtmlList(values, "当前没有足够的可引用依据");
};

const renderSummaryCard = (title: string, items: unknown, tone: string) =>
  `<section class="summary-card ${tone}"><h3>${escapeHtml(title)}</h3>${renderHtmlList(items)}</section>`;

const renderDimensionHtml = (dimension: FertilityDimension) => {
  const completeness = Math.round(dimension.dataCompleteness * 100);
  const scoreText = formatScore(dimension.score);
  return `<article class="dimension-card">
    <div class="dimension-title-row">
      <div><div class="eyebrow">${escapeHtml(dimension.id)}</div><h3>${escapeHtml(dimensionLabel(dimension.id))}</h3></div>
      <div class="score-pill">${escapeHtml(scoreText)}</div>
    </div>
    <div class="dimension-meta"><span>置信度 ${escapeHtml(dimension.confidence)}</span><span>资料完整度 ${completeness}%</span></div>
    <div class="completeness"><span style="width:${completeness}%"></span></div>
    <p class="interpretation">${escapeHtml(dimension.interpretation || "当前信息不足，暂不做进一步解释。")}</p>
    <div class="detail-grid">
      <section><h4>已有依据</h4>${renderEvidenceList(dimension)}</section>
      <section><h4>需要关注</h4>${renderHtmlList(dimension.concerns)}</section>
      <section><h4>还缺什么</h4>${renderHtmlList(dimension.missingEvidence)}</section>
      <section><h4>可以自己先做</h4>${renderHtmlList(dimension.actions.selfCare)}</section>
      <section><h4>与医生讨论</h4>${renderHtmlList(dimension.actions.discussWithClinician)}</section>
      <section><h4>可讨论的检查</h4>${renderHtmlList(dimension.actions.testsToConsider)}</section>
    </div>
  </article>`;
};

const renderHtmlReport = (state: FertilityAssessmentState, generatedAt: string) => {
  const female = FEMALE_DIMENSIONS.map(([id]) => state.dimensions[id]).filter(
    (item): item is FertilityDimension => Boolean(item),
  );
  const male = MALE_DIMENSIONS.map(([id]) => state.dimensions[id]).filter(
    (item): item is FertilityDimension => Boolean(item),
  );

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${REPORT_TITLE}</title>
<style>
  :root{color-scheme:light;--ink:#282522;--muted:#756e67;--line:#e7e0d9;--soft:#f7f3ed;--paper:#fff;--accent:#b8663b;--good:#edf5ef;--warn:#fff4e8;--cool:#eef2f5}
  *{box-sizing:border-box} html{background:#f3efe9} body{margin:0;color:var(--ink);font-family:Inter,"Noto Sans SC","Microsoft YaHei",system-ui,sans-serif;background:#f3efe9;line-height:1.65}
  .report{max-width:1040px;margin:28px auto;background:var(--paper);border:1px solid rgba(80,67,55,.08);border-radius:24px;box-shadow:0 18px 70px rgba(49,41,34,.09);overflow:hidden}
  .cover{padding:54px 58px 44px;background:linear-gradient(135deg,#fffaf4 0%,#fff 56%,#f7efe8 100%);border-bottom:1px solid var(--line)}
  .brand{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--accent);font-weight:700}.cover h1{font-size:38px;line-height:1.2;margin:12px 0 10px;letter-spacing:-.02em}.subtitle{color:var(--muted);font-size:15px}.notice{margin-top:28px;padding:16px 18px;background:rgba(255,255,255,.72);border:1px solid var(--line);border-radius:14px;color:#655d56;font-size:13px}
  .section{padding:38px 58px}.section+.section{border-top:1px solid var(--line)}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:20px}.section-head h2{margin:0;font-size:25px}.section-head p{margin:0;color:var(--muted);font-size:13px}
  .summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.summary-card{padding:18px 20px;border-radius:16px;border:1px solid var(--line);background:#fff}.summary-card h3{font-size:15px;margin:0 0 10px}.summary-card.good{background:var(--good)}.summary-card.warn{background:var(--warn)}.summary-card.cool{background:var(--cool)}.summary-card.soft{background:var(--soft)}
  ul{margin:0;padding-left:19px}li{margin:5px 0}.empty{color:#978f88;font-size:13px}.dimensions{display:grid;grid-template-columns:1fr;gap:16px}.dimension-card{border:1px solid var(--line);border-radius:18px;padding:22px;background:#fff;break-inside:avoid;page-break-inside:avoid}.dimension-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.dimension-title-row h3{margin:2px 0 0;font-size:19px}.eyebrow{font-size:10px;color:#9a9189;letter-spacing:.08em}.score-pill{padding:7px 11px;border-radius:999px;background:#f6eee7;color:#754425;font-size:12px;font-weight:700;white-space:nowrap}.dimension-meta{display:flex;gap:18px;margin:13px 0 7px;color:var(--muted);font-size:12px}.completeness{height:6px;background:#eee9e4;border-radius:999px;overflow:hidden}.completeness span{display:block;height:100%;background:#b77752;border-radius:999px}.interpretation{margin:17px 0;color:#4c4641}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.detail-grid section{background:#faf8f5;border:1px solid #eee9e4;border-radius:13px;padding:13px 15px}.detail-grid h4{font-size:12px;margin:0 0 7px;color:#625a53}.detail-grid ul,.detail-grid .empty{font-size:12px}
  .gap-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.gap-card{border:1px solid var(--line);border-radius:14px;padding:16px;background:#faf8f5}.gap-card h3{margin:0 0 10px;font-size:14px}.footer{padding:24px 58px 36px;color:#817970;font-size:11px;border-top:1px solid var(--line);background:#faf8f5}
  @media(max-width:760px){html,body{background:#fff}.report{margin:0;border:0;border-radius:0;box-shadow:none}.cover,.section{padding:28px 22px}.cover h1{font-size:30px}.summary-grid,.detail-grid,.gap-grid{grid-template-columns:1fr}.dimension-title-row{flex-direction:column}.footer{padding:22px}}
  @page{size:A4;margin:10mm}.page-break{break-before:page;page-break-before:always}
  @media print{html,body{background:#fff}.report{max-width:none;margin:0;border:0;border-radius:0;box-shadow:none}.cover,.section{padding-left:0;padding-right:0}.cover{padding-top:4mm}.dimension-card{box-shadow:none}.summary-card,.dimension-card,.gap-card{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style>
</head>
<body>
<main class="report">
  <header class="cover">
    <div class="brand">MIRA · FERTILITY OVERVIEW</div>
    <h1>${REPORT_TITLE}</h1>
    <div class="subtitle">夫妻备孕信息画像 · 营养与生活方式整理 · 就诊准备</div>
    <div class="notice">生成时间：${escapeHtml(generatedAt)}。本报告仅基于本次对话中用户主动提供的信息；当前 Mira 未核验原始化验单或影像资料。报告用于健康教育、信息整理和就诊准备，不构成诊断、处方或替代生殖专科医生的医疗决策。</div>
  </header>

  <section class="section">
    <div class="section-head"><h2>先看结论</h2><p>优先看方向，不把分数误解为怀孕概率</p></div>
    <div class="summary-grid">
      ${renderSummaryCard("当前优势", state.summary?.strengths, "good")}
      ${renderSummaryCard("当前优先事项", state.summary?.priorities, "warn")}
      ${renderSummaryCard("下次就诊最值得问", state.summary?.visitPrep, "cool")}
      ${renderSummaryCard("生活方式优先级", state.summary?.lifestyleFocus, "soft")}
    </div>
  </section>

  <section class="section">
    <div class="section-head"><h2>女方十维画像</h2><p>状态分 + 置信度 + 数据完整度</p></div>
    <div class="dimensions">${female.map(renderDimensionHtml).join("")}</div>
  </section>

  <section class="section page-break">
    <div class="section-head"><h2>男方十维画像</h2><p>与女方采用完全一致的字段结构</p></div>
    <div class="dimensions">${male.map(renderDimensionHtml).join("")}</div>
  </section>

  <section class="section">
    <div class="section-head"><h2>资料缺口与不确定项</h2><p>不知道，比编一个答案更有价值</p></div>
    <div class="gap-grid">
      <section class="gap-card"><h3>关键缺口</h3>${renderHtmlList(state.missingCriticalFields)}</section>
      <section class="gap-card"><h3>尚未确认</h3>${renderHtmlList(state.uncertainties)}</section>
      <section class="gap-card"><h3>前后可能矛盾</h3>${renderHtmlList(state.contradictions)}</section>
    </div>
  </section>

  <footer class="footer">维度状态分仅用于阅读与优先级排序，不代表怀孕概率。AMH/AFC 主要用于理解卵巢储备与促排反应背景，不能单独等同卵子质量或自然受孕概率。出现异常出血、剧烈腹痛、严重感染症状、妊娠相关急症或其他紧急情况时，应及时线下就医。</footer>
</main>
</body>
</html>`;
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
    const html = renderHtmlReport(reportState, generatedAt);
    const report = {
      markdown: renderMarkdownReport(reportState),
      html,
      generatedAt,
    };
    reportState.report = report;

    await writeSkillReportHtml(session.sessionId, html);

    let pdfAvailable = false;
    let pdfError: string | undefined;
    try {
      await renderHtmlReportToPdf({
        html,
        outputPath: resolveSkillReportPdfPath(session.sessionId),
      });
      pdfAvailable = true;
    } catch (error) {
      pdfError = error instanceof Error ? error.message : String(error);
      writeStructuredLog("warn", {
        scope: "fertility-report",
        event: "pdf-render-failed",
        sessionId: session.sessionId,
        error: pdfError,
      });
    }

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
          format: "inline_html",
          htmlAvailable: true,
          pdfAvailable,
        },
      },
      delivery: {
        kind: "inline_html",
        content: pdfAvailable
          ? "备孕全景报告已经生成。下面可以直接阅读，也可以保存 PDF。"
          : "备孕全景报告已经生成，行内报告可以直接阅读；本机暂时无法完成 PDF 转换。",
        inlineHtml: html,
        reportTitle: REPORT_TITLE,
        pdf: {
          available: pdfAvailable,
          fileName: REPORT_PDF_FILENAME,
          ...(pdfError ? { error: pdfError } : {}),
        },
      },
    };

    return {
      session: { ...nextSession, lastDirective: directive },
      directive,
    };
  },
};
