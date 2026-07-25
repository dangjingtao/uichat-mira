import type {
  FertilityAssessmentState,
  FertilityDimension,
} from "../fertility-assessment/runtime.js";
import {
  getFertilityGoalLabel,
  getFertilityScopeFlags,
  getFertilityScopeLabel,
  type FertilityServiceProfile,
} from "../fertility-assessment/service-profile.js";
import {
  FEMALE_DIMENSIONS,
  MALE_DIMENSIONS,
  type FertilityDimensionPair,
} from "./dimension-analysis.js";

export const FERTILITY_REPORT_SOURCE = {
  brandName: "圆姐聊女性全周期服务",
  teamName: "Mira 生育健康评估服务团队",
  serviceLine: "备孕从了解自己开始，陪伴你一起接好孕。",
  primaryColor: "#5B2A86",
  secondaryColor: "#D79ACB",
  accentColor: "#8FB5E8",
  softBackground: "#F7F2FA",
  textColor: "#2C2530",
  mutedTextColor: "#766B79",
  footerText:
    "本报告用于健康教育、信息整理和就诊准备，不构成诊断、处方或替代生殖专科医生的医疗决策。",
} as const;

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

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

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

const dimensionLabel = (id: string) =>
  [...FEMALE_DIMENSIONS, ...MALE_DIMENSIONS].find(
    ([candidate]) => candidate === id,
  )?.[1] ?? id;

const formatScore = (score: number | null) =>
  typeof score === "number" ? `${score.toFixed(1)} / 10` : "方向性判断";

const confidenceLabel = (confidence: FertilityDimension["confidence"]) => {
  switch (confidence) {
    case "high":
      return "高";
    case "medium":
      return "中";
    case "low":
    default:
      return "低";
  }
};

const renderListMarkdown = (items: unknown) => {
  const values = uniqueStrings(items, 12);
  return values.length > 0
    ? values.map((item) => `- ${item}`).join("\n")
    : "- 暂无足够信息";
};

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

const getSelectedDimensions = (
  state: FertilityAssessmentState,
  pairs: ReadonlyArray<FertilityDimensionPair>,
) =>
  pairs
    .map(([id]) => state.dimensions[id])
    .filter((item): item is FertilityDimension => Boolean(item));

const renderDimensionMarkdown = (dimension: FertilityDimension) => {
  const evidenceFacts = dimension.evidence
    .map((item) =>
      isRecord(item) && typeof item.fact === "string" ? item.fact : "",
    )
    .filter(Boolean);

  return `### ${dimensionLabel(dimension.id)}

**当前结果：${formatScore(dimension.score)}｜置信度：${confidenceLabel(dimension.confidence)}｜资料完整度：${Math.round(dimension.dataCompleteness * 100)}%**

**核心判断**
${dimension.interpretation || "当前信息有限，先保留低置信度方向性判断。"}

**已有依据**
${renderListMarkdown(evidenceFacts)}

**当前关注**
${renderListMarkdown(dimension.concerns)}

**建议补充**
${renderListMarkdown(dimension.missingEvidence)}

**下一步可先做**
${renderListMarkdown(dimension.actions.selfCare)}

**建议与医生讨论**
${renderListMarkdown(dimension.actions.discussWithClinician)}
`;
};

export const buildFertilityReportTitle = (profile: FertilityServiceProfile) =>
  `${profile.displayName} · 生育力综合评估报告`;

export const buildFertilityReportFileName = (profile: FertilityServiceProfile) =>
  `${profile.displayName.replace(/[\\/:*?"<>|]/g, "-")}生育力综合评估报告.pdf`;

export const renderFertilityMarkdownReport = (input: {
  state: FertilityAssessmentState;
  profile: FertilityServiceProfile;
  generatedAt: string;
}) => {
  const { state, profile, generatedAt } = input;
  const flags = getFertilityScopeFlags(profile.assessmentScope);
  const female = flags.includeFemale
    ? getSelectedDimensions(state, FEMALE_DIMENSIONS)
    : [];
  const male = flags.includeMale ? getSelectedDimensions(state, MALE_DIMENSIONS) : [];

  return `# ${buildFertilityReportTitle(profile)}

> 服务对象：${profile.displayName}
> 评估类型：${getFertilityGoalLabel(profile.currentGoal)}
> 评估范围：${getFertilityScopeLabel(profile.assessmentScope)}
> 生成时间：${generatedAt}
> 服务团队：${FERTILITY_REPORT_SOURCE.teamName}

本报告由专属服务团队根据当前对话中用户主动提供的信息整理。当前未核验原始化验单或影像资料，内容用于健康教育、信息整理和就诊准备。

## 服务团队先看结论

### 当前优势
${renderListMarkdown(state.summary?.strengths)}

### 当前优先事项
${renderListMarkdown(state.summary?.priorities)}

### 下次就诊最值得带着问的问题
${renderListMarkdown(state.summary?.visitPrep)}

### 未来一阶段生活方式重点
${renderListMarkdown(state.summary?.lifestyleFocus)}

${female.length > 0 ? `## 女性生育力综合画像\n\n${female.map(renderDimensionMarkdown).join("\n---\n\n")}` : ""}

${male.length > 0 ? `## 男性生育力综合画像\n\n${male.map(renderDimensionMarkdown).join("\n---\n\n")}` : ""}

## 资料缺口与不确定项

### 关键缺口
${renderListMarkdown(state.missingCriticalFields)}

### 尚未确认
${renderListMarkdown(state.uncertainties)}

### 前后可能矛盾
${renderListMarkdown(state.contradictions)}

---

**重要说明**：维度结果用于帮助阅读和排序，不代表怀孕概率。${FERTILITY_REPORT_SOURCE.footerText}
`;
};

const renderSummaryBlock = (title: string, items: unknown, tone: string) =>
  `<section class="summary-block ${tone}"><h3>${escapeHtml(title)}</h3>${renderHtmlList(items)}</section>`;

const renderDimensionHtml = (dimension: FertilityDimension) => {
  const completeness = Math.round(dimension.dataCompleteness * 100);
  return `<article class="dimension-card">
    <div class="dimension-title-row">
      <div>
        <div class="eyebrow">${escapeHtml(dimension.id)}</div>
        <h3>${escapeHtml(dimensionLabel(dimension.id))}</h3>
      </div>
      <div class="score-pill">${escapeHtml(formatScore(dimension.score))}</div>
    </div>
    <div class="dimension-meta">
      <span>置信度：${escapeHtml(confidenceLabel(dimension.confidence))}</span>
      <span>资料完整度：${completeness}%</span>
    </div>
    <div class="completeness"><span style="width:${completeness}%"></span></div>
    <section class="core-judgement">
      <h4>核心判断</h4>
      <p>${escapeHtml(dimension.interpretation || "当前信息有限，先保留低置信度方向性判断。")}</p>
    </section>
    <div class="detail-grid">
      <section><h4>已有依据</h4>${renderEvidenceList(dimension)}</section>
      <section><h4>当前关注</h4>${renderHtmlList(dimension.concerns)}</section>
      <section><h4>建议补充</h4>${renderHtmlList(dimension.missingEvidence)}</section>
      <section><h4>下一步可先做</h4>${renderHtmlList(dimension.actions.selfCare)}</section>
      <section><h4>建议与医生讨论</h4>${renderHtmlList(dimension.actions.discussWithClinician)}</section>
      <section><h4>可讨论的检查</h4>${renderHtmlList(dimension.actions.testsToConsider)}</section>
    </div>
  </article>`;
};

const renderDimensionSection = (input: {
  title: string;
  subtitle: string;
  dimensions: FertilityDimension[];
  pageBreak?: boolean;
}) => {
  if (input.dimensions.length === 0) return "";
  return `<section class="section dimension-section${input.pageBreak ? " page-break" : ""}">
    <div class="section-head"><h2>${escapeHtml(input.title)}</h2><p>${escapeHtml(input.subtitle)}</p></div>
    <div class="dimensions">${input.dimensions.map(renderDimensionHtml).join("")}</div>
  </section>`;
};

export const renderFertilityHtmlReport = (input: {
  state: FertilityAssessmentState;
  profile: FertilityServiceProfile;
  generatedAt: string;
}) => {
  const { state, profile, generatedAt } = input;
  const flags = getFertilityScopeFlags(profile.assessmentScope);
  const female = flags.includeFemale
    ? getSelectedDimensions(state, FEMALE_DIMENSIONS)
    : [];
  const male = flags.includeMale ? getSelectedDimensions(state, MALE_DIMENSIONS) : [];
  const title = buildFertilityReportTitle(profile);
  const goalLabel = getFertilityGoalLabel(profile.currentGoal);
  const scopeLabel = getFertilityScopeLabel(profile.assessmentScope);

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root{color-scheme:light;--primary:${FERTILITY_REPORT_SOURCE.primaryColor};--secondary:${FERTILITY_REPORT_SOURCE.secondaryColor};--accent:${FERTILITY_REPORT_SOURCE.accentColor};--soft:${FERTILITY_REPORT_SOURCE.softBackground};--ink:${FERTILITY_REPORT_SOURCE.textColor};--muted:${FERTILITY_REPORT_SOURCE.mutedTextColor};--line:#E4D9E8;--paper:#fff}
  *{box-sizing:border-box} html{background:#F3EFF5} body{margin:0;color:var(--ink);font-family:Inter,"Noto Sans SC","Microsoft YaHei",system-ui,sans-serif;background:#F3EFF5;line-height:1.65}
  .report{max-width:1040px;margin:28px auto;background:var(--paper);border:1px solid rgba(91,42,134,.10);border-radius:22px;box-shadow:0 18px 64px rgba(61,36,79,.10);overflow:hidden}
  .print-header,.print-footer{display:none}
  .cover{min-height:620px;padding:56px 60px 48px;background:linear-gradient(145deg,#FFF 0%,#FBF6FD 58%,#EEF4FC 100%);border-bottom:8px solid var(--primary);position:relative}
  .brand{font-size:13px;letter-spacing:.12em;color:var(--primary);font-weight:800}.service-line{margin-top:8px;color:var(--muted);font-size:14px}.cover h1{font-size:40px;line-height:1.22;margin:64px 0 12px;letter-spacing:-.02em;color:var(--primary)}.cover-subtitle{font-size:18px;color:#504555}
  .service-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;margin-top:54px;border-top:2px solid var(--primary);border-bottom:1px solid var(--line)}.service-meta div{padding:15px 18px;border-bottom:1px solid var(--line)}.service-meta div:nth-child(odd){border-right:1px solid var(--line)}.service-meta span{display:block;color:var(--muted);font-size:12px}.service-meta strong{display:block;margin-top:4px;font-size:16px;color:var(--ink)}
  .team-note{margin-top:30px;padding:18px 20px;border-left:5px solid var(--secondary);background:rgba(255,255,255,.76);color:#5F5363;font-size:13px}.team-sign{position:absolute;right:60px;bottom:34px;text-align:right;color:var(--muted);font-size:12px}.team-sign strong{display:block;color:var(--primary);font-size:15px}
  .section{padding:38px 58px}.section+.section{border-top:1px solid var(--line)}.section-head{display:flex;align-items:end;justify-content:space-between;gap:20px;margin-bottom:22px}.section-head h2{margin:0;font-size:26px;color:var(--primary)}.section-head p{margin:0;color:var(--muted);font-size:13px}
  .summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.summary-block{padding:18px 20px;border-top:4px solid var(--secondary);background:#FCFAFD}.summary-block h3{font-size:15px;margin:0 0 10px;color:var(--primary)}.summary-block.warn{border-top-color:#D28A49}.summary-block.cool{border-top-color:var(--accent)}.summary-block.soft{border-top-color:#9A85B8}
  ul{margin:0;padding-left:19px}li{margin:5px 0}.empty{color:#9B919F;font-size:13px}.dimensions{display:grid;grid-template-columns:1fr;gap:18px}.dimension-card{border-top:2px solid var(--primary);padding:22px 0 4px;background:#fff;break-inside:avoid;page-break-inside:avoid}.dimension-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.dimension-title-row h3{margin:2px 0 0;font-size:20px}.eyebrow{font-size:10px;color:#9A8EA0;letter-spacing:.08em}.score-pill{padding:6px 10px;border-radius:4px;background:#F0E7F5;color:var(--primary);font-size:12px;font-weight:800;white-space:nowrap}.dimension-meta{display:flex;gap:18px;margin:13px 0 7px;color:var(--muted);font-size:12px}.completeness{height:6px;background:#EEE8F1;border-radius:999px;overflow:hidden}.completeness span{display:block;height:100%;background:linear-gradient(90deg,var(--secondary),var(--primary));border-radius:999px}.core-judgement{margin:18px 0 6px;padding:14px 0;border-bottom:1px solid var(--line)}.core-judgement h4{margin:0 0 6px;color:var(--primary);font-size:13px}.core-judgement p{margin:0}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px}.detail-grid section{padding:13px 0;border-bottom:1px solid #EFE8F1}.detail-grid h4{font-size:12px;margin:0 0 7px;color:#62576A}.detail-grid ul,.detail-grid .empty{font-size:12px}
  .gap-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.gap-block{border-top:3px solid var(--secondary);padding:14px 0}.gap-block h3{margin:0 0 10px;font-size:14px;color:var(--primary)}.report-footer{padding:24px 58px 36px;color:#817486;font-size:11px;border-top:1px solid var(--line);background:#FAF7FB}
  @media(max-width:760px){html,body{background:#fff}.report{margin:0;border:0;border-radius:0;box-shadow:none}.cover,.section{padding:28px 22px}.cover{min-height:auto}.cover h1{font-size:30px;margin-top:40px}.service-meta,.summary-grid,.detail-grid,.gap-grid{grid-template-columns:1fr}.service-meta div:nth-child(odd){border-right:0}.team-sign{position:static;margin-top:28px}.dimension-title-row{flex-direction:column}.report-footer{padding:22px}}
  @page{size:A4;margin:18mm 12mm 18mm}.page-break{break-before:page;page-break-before:always}
  @media print{html,body{background:#fff}.report{max-width:none;margin:0;border:0;border-radius:0;box-shadow:none;overflow:visible}.cover{min-height:248mm;padding:18mm 0 12mm}.section{padding:10mm 0}.print-header{display:flex;position:fixed;top:-12mm;left:0;right:0;justify-content:space-between;border-bottom:1px solid #DCCFE2;padding-bottom:2.5mm;color:#6C5E72;font-size:9px}.print-footer{display:flex;position:fixed;bottom:-12mm;left:0;right:0;justify-content:space-between;border-top:1px solid #DCCFE2;padding-top:2.5mm;color:#7D7082;font-size:8px}.summary-block,.dimension-card,.detail-grid section,.gap-block,.section-head,.dimension-title-row,h2,h3,h4{break-inside:avoid-page;page-break-inside:avoid}.dimension-card{break-inside:avoid-page;page-break-inside:avoid}.summary-block,.dimension-card,.gap-block{print-color-adjust:exact;-webkit-print-color-adjust:exact}p,li{orphans:3;widows:3}}
</style>
</head>
<body>
<div class="print-header"><span>${escapeHtml(FERTILITY_REPORT_SOURCE.brandName)}</span><span>${escapeHtml(profile.displayName)} · 专属评估报告</span></div>
<div class="print-footer"><span>${escapeHtml(FERTILITY_REPORT_SOURCE.footerText)}</span><span>${escapeHtml(FERTILITY_REPORT_SOURCE.teamName)}</span></div>
<main class="report" data-fertility-scope="${profile.assessmentScope}">
  <header class="cover">
    <div class="brand">${escapeHtml(FERTILITY_REPORT_SOURCE.brandName)}</div>
    <div class="service-line">${escapeHtml(FERTILITY_REPORT_SOURCE.serviceLine)}</div>
    <h1>${escapeHtml(title)}</h1>
    <div class="cover-subtitle">${escapeHtml(goalLabel)} · 专属服务团队交付</div>
    <div class="service-meta">
      <div><span>服务对象</span><strong>${escapeHtml(profile.displayName)}</strong></div>
      <div><span>评估类型</span><strong>${escapeHtml(goalLabel)}</strong></div>
      <div><span>评估范围</span><strong>${escapeHtml(scopeLabel)}</strong></div>
      <div><span>报告日期</span><strong>${escapeHtml(generatedAt.slice(0, 10))}</strong></div>
    </div>
    <div class="team-note">本报告由专属服务团队根据您在本次评估中主动提供的信息整理，综合呈现当前优势、关注重点、资料缺口和下一步行动方向。当前未核验原始化验单或影像资料，所有医疗决策仍需由生殖专科医生结合面诊与原始资料完成。</div>
    <div class="team-sign"><strong>${escapeHtml(FERTILITY_REPORT_SOURCE.teamName)}</strong>专业评估 · 信息整理 · 就诊准备</div>
  </header>

  <section class="section">
    <div class="section-head"><h2>服务团队先看结论</h2><p>先看方向，再阅读各维度依据</p></div>
    <div class="summary-grid">
      ${renderSummaryBlock("当前优势", state.summary?.strengths, "good")}
      ${renderSummaryBlock("当前优先事项", state.summary?.priorities, "warn")}
      ${renderSummaryBlock("下次就诊最值得问", state.summary?.visitPrep, "cool")}
      ${renderSummaryBlock("未来一阶段生活方式重点", state.summary?.lifestyleFocus, "soft")}
    </div>
  </section>

  ${renderDimensionSection({
    title: "女性生育力综合画像",
    subtitle: "十维状态、证据完整度与行动方向",
    dimensions: female,
  })}

  ${renderDimensionSection({
    title: "男性生育力综合画像",
    subtitle: "十维状态、证据完整度与行动方向",
    dimensions: male,
    pageBreak: female.length > 0,
  })}

  <section class="section">
    <div class="section-head"><h2>资料缺口与不确定项</h2><p>清楚标注未知，比制造确定答案更重要</p></div>
    <div class="gap-grid">
      <section class="gap-block"><h3>关键缺口</h3>${renderHtmlList(state.missingCriticalFields)}</section>
      <section class="gap-block"><h3>尚未确认</h3>${renderHtmlList(state.uncertainties)}</section>
      <section class="gap-block"><h3>前后可能矛盾</h3>${renderHtmlList(state.contradictions)}</section>
    </div>
  </section>

  <footer class="report-footer">${escapeHtml(FERTILITY_REPORT_SOURCE.footerText)} 维度结果用于阅读与优先级排序，不代表怀孕概率。</footer>
</main>
</body>
</html>`;
};
