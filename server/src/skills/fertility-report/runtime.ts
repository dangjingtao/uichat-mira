import { writeStructuredLog } from "@/logger";
import {
  toFertilityAssessmentState,
  type FertilityAssessmentState,
} from "../fertility-assessment/runtime.js";
import {
  getFertilityScopeFlags,
  resolveFertilityServiceProfile,
} from "../fertility-assessment/service-profile.js";
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
import { applyFertilityReportContentPolicy } from "./content-policy.js";
import {
  buildFertilityReportContent,
  getFertilityDimensionPairs,
} from "./dimension-analysis.js";
import { enhanceFertilityReportHtml } from "./report-document-enhancer.js";
import { applyFertilityReportProfile } from "./report-profile.js";
import {
  buildFertilityReportFileName,
  buildFertilityReportTitle,
  renderFertilityHtmlReport,
  renderFertilityMarkdownReport,
} from "./report-renderer.js";
import { applyFertilityScoringProfile } from "./scoring-calibration.js";
import { loadFertilitySourceBundle } from "./source-config.js";

const withUpdatedState = (
  session: StoredSkillFlowSession,
  state: FertilityAssessmentState,
): StoredSkillFlowSession => ({
  ...session,
  status: "ready",
  state: state as unknown as Record<string, unknown>,
  updatedAt: new Date().toISOString(),
});

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

const appendClosingToHtml = (html: string, closingMessage: string) => {
  const closing = closingMessage.trim();
  if (!closing) return html;
  const section = `<section class="section closing-section" id="section-closing">
    <div class="section-head"><h2>写在最后</h2><p>来自专属服务团队的一段话</p></div>
    <div style="padding:24px 28px;border-left:5px solid var(--secondary);background:var(--soft);font-size:16px;line-height:1.9;color:var(--ink)">${escapeHtml(closing)}</div>
  </section>`;
  const footerMarker = '<footer class="report-footer">';
  return html.includes(footerMarker)
    ? html.replace(footerMarker, `${section}\n${footerMarker}`)
    : `${html}${section}`;
};

const appendClosingToMarkdown = (markdown: string, closingMessage: string) => {
  const closing = closingMessage.trim();
  return closing ? `${markdown.trim()}\n\n## 写在最后\n\n${closing}\n` : markdown;
};

const removeInternalDimensionIds = (html: string) =>
  html.replace(/<div class="eyebrow">[^<]*<\/div>/g, "");

export const fertilityReportRuntime: SkillDirectiveHandoffRuntime = {
  skillId: "fertility-report",
  version: "1.2.0",

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
    const profile = resolveFertilityServiceProfile(assessment.facts);
    const scopeFlags = getFertilityScopeFlags(profile.assessmentScope);
    const sourceBundle = loadFertilitySourceBundle({
      reportProfileId: profile.reportProfileId,
      scoringProfileId: profile.scoringProfileId,
    });
    for (const diagnostic of sourceBundle.diagnostics) {
      writeStructuredLog("warn", {
        scope: "fertility-report",
        event: "source-config-fallback",
        sessionId: session.sessionId,
        diagnostic,
      });
    }

    const dimensionPairs = getFertilityDimensionPairs(profile.assessmentScope);
    const generatedContent = await buildFertilityReportContent(
      assessment,
      dimensionPairs,
    );
    const calibratedDimensions = applyFertilityScoringProfile({
      dimensions: generatedContent.dimensions,
      profile: sourceBundle.scoringProfile,
    });
    const governedContent = applyFertilityReportContentPolicy({
      dimensions: calibratedDimensions,
      summary: generatedContent.summary,
      closingMessage: generatedContent.closingMessage,
    });
    const reportState: FertilityAssessmentState = {
      ...assessment,
      dimensions: governedContent.dimensions,
      summary: governedContent.summary,
      closingMessage: governedContent.closingMessage,
    };
    const generatedAt = new Date().toISOString();
    const rawHtml = enhanceFertilityReportHtml(
      appendClosingToHtml(
        removeInternalDimensionIds(
          renderFertilityHtmlReport({
            state: reportState,
            profile,
            generatedAt,
          }),
        ),
        governedContent.closingMessage,
      ),
    );
    const rawMarkdown = appendClosingToMarkdown(
      renderFertilityMarkdownReport({
        state: reportState,
        profile,
        generatedAt,
      }),
      governedContent.closingMessage,
    );
    const profiledReport = applyFertilityReportProfile({
      html: rawHtml,
      markdown: rawMarkdown,
      profile: sourceBundle.reportProfile,
      scoringVersion: sourceBundle.scoringProfile.version,
    });
    const html = profiledReport.html;
    const report = {
      markdown: profiledReport.markdown,
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
          reportType: profile.assessmentScope,
          displayName: profile.displayName,
          currentGoal: profile.currentGoal,
          format: "inline_html",
          includeFemale: scopeFlags.includeFemale,
          includeMale: scopeFlags.includeMale,
          htmlAvailable: true,
          pdfAvailable,
          reportProfileId: sourceBundle.reportProfile.id,
          scoringProfileId: sourceBundle.scoringProfile.id,
          scoringProfileVersion: sourceBundle.scoringProfile.version,
        },
      },
      delivery: {
        kind: "inline_html",
        content: pdfAvailable
          ? `${profile.displayName}的专属生育力评估报告已经生成。下面可以直接阅读，也可以保存 PDF。`
          : `${profile.displayName}的专属生育力评估报告已经生成，行内报告可以直接阅读；本机暂时无法完成 PDF 转换。`,
        inlineHtml: html,
        reportTitle: buildFertilityReportTitle(profile),
        pdf: {
          available: pdfAvailable,
          fileName: buildFertilityReportFileName(profile),
          ...(pdfError ? { error: pdfError } : {}),
        },
      },
    };

    writeStructuredLog("info", {
      scope: "fertility-report",
      event: "source-profiles-applied",
      sessionId: session.sessionId,
      requestedReportProfileId: profile.reportProfileId,
      requestedScoringProfileId: profile.scoringProfileId,
      reportProfileId: sourceBundle.reportProfile.id,
      scoringProfileId: sourceBundle.scoringProfile.id,
      scoringProfileVersion: sourceBundle.scoringProfile.version,
      generationMode:
        profile.assessmentScope === "couple"
          ? "female-plus-male-plus-joint-summary"
          : "single-subject-one-pass",
    });

    return {
      session: { ...nextSession, lastDirective: directive },
      directive,
    };
  },
};
