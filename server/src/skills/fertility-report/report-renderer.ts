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
import {
  FERTILITY_SCORING_VERSION,
  getFertilityScoreBand,
} from "./scoring-rules.js";

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

const BAND_COLORS: Record<string, string> = {
  advantage: "#4F8A68",
  stable: "#6F76B8",
  optimize: "#C49045",
  concern: "#C36B66",
  priority: "#9D4256",
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

const numericScore = (score: number | null) =>
  typeof score === "number" && Number.isFinite(score) ? score : 5;

const formatScore = (score: number | null) => `${numericScore(score).toFixed(1)} / 10`;

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

const scoreBand = (dimension: FertilityDimension) =>
  getFertilityScoreBand(numericScore(dimension.score));

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
  const band = scoreBand(dimension);

  return `### ${dimensionLabel(dimension.id)}

**当前结果：${formatScore(dimension.score)}｜${band.label}｜置信度：${confidenceLabel(dimension.confidence)}｜资料完整度：${Math.round(dimension.dataCompleteness * 100)}%**

**核心判断**
${dimension.interpretation || "当前信息有限，评分为低置信度参考结果，后续补充资料后应重新计算。"}

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

const renderScoreLegendMarkdown = () =>
  "评分区间：8–10 优势维持；6.5–7.9 总体稳定；5–6.4 建议优化；3–4.9 需要关注；0–2.9 优先评估。置信度用于表示证据完整程度，低置信度不等于低风险。";

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
> 评分规则：${FERTILITY_SCORING_VERSION}

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

## 十维量化画像说明

${renderScoreLegendMarkdown()}

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

**重要说明**：维度结果用于帮助阅读和排序，不代表怀孕概率。低置信度维度是依据有限时的参考结果，不应独立用于医疗决策。${FERTILITY_REPORT_SOURCE.footerText}
`;
};

const renderSummaryBlock = (title: string, items: unknown, tone: string) =>
  `<section class="summary-block ${tone}"><h3>${escapeHtml(title)}</h3>${renderHtmlList(items)}</section>`;

const polarPoint = (cx: number, cy: number, radius: number, degrees: number) => {
  const angle = ((degrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
};

const pointsAttribute = (points: Array<{ x: number; y: number }>) =>
  points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");

const renderRadarSvg = (input: {
  title: string;
  dimensions: FertilityDimension[];
  pairs: ReadonlyArray<FertilityDimensionPair>;
}) => {
  const width = 620;
  const height = 470;
  const cx = 310;
  const cy = 220;
  const radius = 145;
  const labelRadius = 190;
  const step = 360 / input.pairs.length;
  const byId = new Map(input.dimensions.map((dimension) => [dimension.id, dimension]));

  const rings = [2, 4, 6, 8, 10]
    .map((score) => {
      const ringRadius = (score / 10) * radius;
      const ringPoints = input.pairs.map((_, index) =>
        polarPoint(cx, cy, ringRadius, index * step),
      );
      return `<polygon points="${pointsAttribute(ringPoints)}" class="radar-ring"/><text x="${cx + 5}" y="${(cy - ringRadius + 13).toFixed(2)}" class="radar-scale">${score}</text>`;
    })
    .join("");

  const axes = input.pairs
    .map((_, index) => {
      const point = polarPoint(cx, cy, radius, index * step);
      return `<line x1="${cx}" y1="${cy}" x2="${point.x.toFixed(2)}" y2="${point.y.toFixed(2)}" class="radar-axis"/>`;
    })
    .join("");

  const valuePoints = input.pairs.map(([id], index) => {
    const dimension = byId.get(id);
    return polarPoint(
      cx,
      cy,
      (numericScore(dimension?.score ?? null) / 10) * radius,
      index * step,
    );
  });

  const labels = input.pairs
    .map(([id, label], index) => {
      const dimension = byId.get(id);
      const point = polarPoint(cx, cy, labelRadius, index * step);
      const anchor =
        point.x < cx - 12 ? "end" : point.x > cx + 12 ? "start" : "middle";
      const score = numericScore(dimension?.score ?? null);
      const confidence = dimension ? confidenceLabel(dimension.confidence) : "低";
      return `<text x="${point.x.toFixed(2)}" y="${point.y.toFixed(2)}" text-anchor="${anchor}" class="radar-label">${escapeHtml(label)}</text>
        <text x="${point.x.toFixed(2)}" y="${(point.y + 15).toFixed(2)}" text-anchor="${anchor}" class="radar-value">${score.toFixed(1)} · ${confidence}置信度</text>`;
    })
    .join("");

  const nodes = input.pairs
    .map(([id], index) => {
      const dimension = byId.get(id);
      const point = valuePoints[index];
      const band = getFertilityScoreBand(numericScore(dimension?.score ?? null));
      const color = BAND_COLORS[band.id] ?? FERTILITY_REPORT_SOURCE.primaryColor;
      return `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="4.5" fill="${color}" class="${dimension?.confidence === "low" ? "low-confidence-node" : ""}"/>`;
    })
    .join("");

  return `<figure class="radar-figure">
    <figcaption><strong>${escapeHtml(input.title)}</strong><span>分数显示当前方向，标签同时标注置信度</span></figcaption>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(input.title)}">
      ${rings}
      ${axes}
      <polygon points="${pointsAttribute(valuePoints)}" class="radar-value-area"/>
      ${nodes}
      ${labels}
    </svg>
  </figure>`;
};

const renderScoreBars = (input: {
  title: string;
  dimensions: FertilityDimension[];
  pairs: ReadonlyArray<FertilityDimensionPair>;
}) => {
  const byId = new Map(input.dimensions.map((dimension) => [dimension.id, dimension]));
  const rows = input.pairs
    .map(([id, label]) => {
      const dimension = byId.get(id);
      const score = numericScore(dimension?.score ?? null);
      const band = getFertilityScoreBand(score);
      const color = BAND_COLORS[band.id] ?? FERTILITY_REPORT_SOURCE.primaryColor;
      const confidence = dimension ? confidenceLabel(dimension.confidence) : "低";
      const completeness = Math.round((dimension?.dataCompleteness ?? 0) * 100);
      return `<div class="score-row">
        <div class="score-name">${escapeHtml(label)}</div>
        <div class="score-track"><span class="${dimension?.confidence === "low" ? "low-confidence-bar" : ""}" style="width:${score * 10}%;background:${color}"></span></div>
        <div class="score-number">${score.toFixed(1)}</div>
        <div class="score-confidence">${confidence} · ${completeness}%</div>
      </div>`;
    })
    .join("");

  return `<section class="score-bars">
    <div class="score-bars-head"><strong>${escapeHtml(input.title)}</strong><span>分数 · 置信度 · 资料完整度</span></div>
    ${rows}
  </section>`;
};

const renderVisualOverview = (input: {
  female: FertilityDimension[];
  male: FertilityDimension[];
}) => {
  const figures = [
    input.female.length > 0
      ? `<div class="visual-column">${renderRadarSvg({
          title: "女性十维雷达画像",
          dimensions: input.female,
          pairs: FEMALE_DIMENSIONS,
        })}${renderScoreBars({
          title: "女性十维评分明细",
          dimensions: input.female,
          pairs: FEMALE_DIMENSIONS,
        })}</div>`
      : "",
    input.male.length > 0
      ? `<div class="visual-column">${renderRadarSvg({
          title: "男性十维雷达画像",
          dimensions: input.male,
          pairs: MALE_DIMENSIONS,
        })}${renderScoreBars({
          title: "男性十维评分明细",
          dimensions: input.male,
          pairs: MALE_DIMENSIONS,
        })}</div>`
      : "",
  ].filter(Boolean);

  if (figures.length === 0) return "";
  return `<section class="section visual-overview page-break">
    <div class="section-head"><h2>十维量化画像</h2><p>固定规则计算 · 低置信度仍给参考结果</p></div>
    <div class="score-legend">
      <span><i style="background:${BAND_COLORS.advantage}"></i>8–10 优势维持</span>
      <span><i style="background:${BAND_COLORS.stable}"></i>6.5–7.9 总体稳定</span>
      <span><i style="background:${BAND_COLORS.optimize}"></i>5–6.4 建议优化</span>
      <span><i style="background:${BAND_COLORS.concern}"></i>3–4.9 需要关注</span>
      <span><i style="background:${BAND_COLORS.priority}"></i>0–2.9 优先评估</span>
    </div>
    <p class="scoring-note">评分用于形成可比较的当前画像，不代表怀孕概率。资料不足时，结果会向中性基准收缩并标记低置信度；补充资料后重新计算。</p>
    <div class="visual-grid ${figures.length === 1 ? "single" : ""}">${figures.join("")}</div>
  </section>`;
};

const renderDimensionHtml = (dimension: FertilityDimension) => {
  const completeness = Math.round(dimension.dataCompleteness * 100);
  const band = scoreBand(dimension);
  const bandColor = BAND_COLORS[band.id] ?? FERTILITY_REPORT_SOURCE.primaryColor;
  return `<article class="dimension-card">
    <div class="dimension-title-row">
      <div>
        <div class="eyebrow">${escapeHtml(dimension.id)}</div>
        <h3>${escapeHtml(dimensionLabel(dimension.id))}</h3>
      </div>
      <div class="score-summary">
        <div class="score-pill" style="border-color:${bandColor};color:${bandColor}">${escapeHtml(formatScore(dimension.score))}</div>
        <div class="score-band">${escapeHtml(band.label)}</div>
      </div>
    </div>
    <div class="dimension-meta">
      <span>置信度：${escapeHtml(confidenceLabel(dimension.confidence))}</span>
      <span>资料完整度：${completeness}%</span>
      <span>规则版本：${escapeHtml(FERTILITY_SCORING_VERSION)}</span>
    </div>
    <div class="completeness"><span style="width:${completeness}%"></span></div>
    <section class="core-judgement">
      <h4>核心判断</h4>
      <p>${escapeHtml(dimension.interpretation || "当前信息有限，本分数为低置信度参考结果，后续补充资料后应重新计算。")}</p>
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
  ul{margin:0;padding-left:19px}li{margin:5px 0}.empty{color:#9B919F;font-size:13px}
  .score-legend{display:flex;flex-wrap:wrap;gap:8px 18px;padding:10px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line);font-size:11px;color:var(--muted)}.score-legend span{display:inline-flex;align-items:center;gap:6px}.score-legend i{display:inline-block;width:9px;height:9px;border-radius:50%}.scoring-note{font-size:12px;color:var(--muted);margin:12px 0 24px}
  .visual-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}.visual-grid.single{grid-template-columns:minmax(0,760px);justify-content:center}.visual-column{min-width:0;border-top:3px solid var(--secondary);padding-top:16px}.radar-figure{margin:0;break-inside:avoid;page-break-inside:avoid}.radar-figure figcaption,.score-bars-head{display:flex;justify-content:space-between;gap:16px;align-items:baseline;margin-bottom:8px}.radar-figure figcaption strong,.score-bars-head strong{color:var(--primary)}.radar-figure figcaption span,.score-bars-head span{color:var(--muted);font-size:10px}.radar-figure svg{display:block;width:100%;height:auto}.radar-ring{fill:none;stroke:#DDD1E2;stroke-width:1}.radar-axis{stroke:#E8E0EB;stroke-width:1}.radar-scale{fill:#A095A5;font-size:9px}.radar-value-area{fill:var(--secondary);fill-opacity:.22;stroke:var(--primary);stroke-width:2}.radar-label{fill:#4C4051;font-size:10px}.radar-value{fill:#837688;font-size:8.5px}.low-confidence-node{stroke:#fff;stroke-width:2;stroke-dasharray:2 1}
  .score-bars{margin-top:16px;border-top:1px solid var(--line);padding-top:12px;break-inside:avoid;page-break-inside:avoid}.score-row{display:grid;grid-template-columns:minmax(110px,1.35fr) minmax(90px,2fr) 36px 62px;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #F0EAF2;font-size:10px}.score-name{color:#544859}.score-track{height:7px;background:#EEE7F0;overflow:hidden}.score-track span{display:block;height:100%}.low-confidence-bar{opacity:.52;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.45) 0 3px,transparent 3px 6px)!important}.score-number{font-weight:800;text-align:right}.score-confidence{color:var(--muted);text-align:right}
  .dimensions{display:grid;grid-template-columns:1fr;gap:18px}.dimension-card{border-top:2px solid var(--primary);padding:22px 0 4px;background:#fff;break-inside:avoid;page-break-inside:avoid}.dimension-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.dimension-title-row h3{margin:2px 0 0;font-size:20px}.eyebrow{font-size:10px;color:#9A8EA0;letter-spacing:.08em}.score-summary{text-align:right}.score-pill{display:inline-block;padding:6px 10px;border:1px solid;border-radius:4px;background:#fff;font-size:12px;font-weight:800;white-space:nowrap}.score-band{margin-top:4px;color:var(--muted);font-size:10px}.dimension-meta{display:flex;flex-wrap:wrap;gap:18px;margin:13px 0 7px;color:var(--muted);font-size:12px}.completeness{height:6px;background:#EEE8F1;border-radius:999px;overflow:hidden}.completeness span{display:block;height:100%;background:linear-gradient(90deg,var(--secondary),var(--primary));border-radius:999px}.core-judgement{margin:18px 0 6px;padding:14px 0;border-bottom:1px solid var(--line)}.core-judgement h4{margin:0 0 6px;color:var(--primary);font-size:13px}.core-judgement p{margin:0}.detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px}.detail-grid section{padding:13px 0;border-bottom:1px solid #EFE8F1}.detail-grid h4{font-size:12px;margin:0 0 7px;color:#62576A}.detail-grid ul,.detail-grid .empty{font-size:12px}
  .gap-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.gap-block{border-top:3px solid var(--secondary);padding:14px 0}.gap-block h3{margin:0 0 10px;font-size:14px;color:var(--primary)}.report-footer{padding:24px 58px 36px;color:#817486;font-size:11px;border-top:1px solid var(--line);background:#FAF7FB}
  @media(max-width:760px){html,body{background:#fff}.report{margin:0;border:0;border-radius:0;box-shadow:none}.cover,.section{padding:28px 22px}.cover{min-height:auto}.cover h1{font-size:30px;margin-top:40px}.service-meta,.summary-grid,.detail-grid,.gap-grid,.visual-grid{grid-template-columns:1fr}.service-meta div:nth-child(odd){border-right:0}.team-sign{position:static;margin-top:28px}.dimension-title-row{flex-direction:column}.score-summary{text-align:left}.report-footer{padding:22px}}
  @page{size:A4;margin:18mm 12mm 18mm}.page-break{break-before:page;page-break-before:always}
  @media print{html,body{background:#fff}.report{max-width:none;margin:0;border:0;border-radius:0;box-shadow:none;overflow:visible}.cover{min-height:248mm;padding:18mm 0 12mm}.section{padding:10mm 0}.print-header{display:flex;position:fixed;top:-12mm;left:0;right:0;justify-content:space-between;border-bottom:1px solid #DCCFE2;padding-bottom:2.5mm;color:#6C5E72;font-size:9px}.print-footer{display:flex;position:fixed;bottom:-12mm;left:0;right:0;justify-content:space-between;border-top:1px solid #DCCFE2;padding-top:2.5mm;color:#7D7082;font-size:8px}.visual-grid{grid-template-columns:1fr}.visual-column+.visual-column{break-before:page;page-break-before:always}.radar-figure,.score-bars,.summary-block,.dimension-card,.detail-grid section,.gap-block,.section-head,.dimension-title-row,h2,h3,h4,figcaption{break-inside:avoid-page;page-break-inside:avoid}.dimension-card{break-inside:avoid-page;page-break-inside:avoid}.summary-block,.dimension-card,.gap-block,.visual-column{print-color-adjust:exact;-webkit-print-color-adjust:exact}p,li{orphans:3;widows:3}}
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
      <div><span>评分规则</span><strong>${escapeHtml(FERTILITY_SCORING_VERSION)}</strong></div>
      <div><span>报告性质</span><strong>量化画像与行动建议</strong></div>
    </div>
    <div class="team-note">本报告由专属服务团队根据您在本次评估中主动提供的信息整理。所有维度均由固定量化规则计算；资料不足时仍给出向中性基准收缩的低置信度参考分，并明确标注缺失依据。当前未核验原始化验单或影像资料，医疗决策仍需由生殖专科医生结合面诊与原始资料完成。</div>
    <div class="team-sign"><strong>${escapeHtml(FERTILITY_REPORT_SOURCE.teamName)}</strong>专业评估 · 量化画像 · 就诊准备</div>
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

  ${renderVisualOverview({ female, male })}

  ${renderDimensionSection({
    title: "女性生育力综合画像",
    subtitle: "十维分数、证据置信度与行动方向",
    dimensions: female,
    pageBreak: true,
  })}

  ${renderDimensionSection({
    title: "男性生育力综合画像",
    subtitle: "十维分数、证据置信度与行动方向",
    dimensions: male,
    pageBreak: female.length > 0,
  })}

  <section class="section">
    <div class="section-head"><h2>资料缺口与不确定项</h2><p>低置信度不等于低风险，也不等于异常</p></div>
    <div class="gap-grid">
      <section class="gap-block"><h3>关键缺口</h3>${renderHtmlList(state.missingCriticalFields)}</section>
      <section class="gap-block"><h3>尚未确认</h3>${renderHtmlList(state.uncertainties)}</section>
      <section class="gap-block"><h3>前后可能矛盾</h3>${renderHtmlList(state.contradictions)}</section>
    </div>
  </section>

  <footer class="report-footer">${escapeHtml(FERTILITY_REPORT_SOURCE.footerText)} 维度分数用于形成当前画像和排序，不代表怀孕概率。</footer>
</main>
</body>
</html>`;
};
