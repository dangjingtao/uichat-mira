import { writeStructuredLog } from "@/logger";
import { toFertilityAssessmentState } from "../fertility-assessment/runtime.js";
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
import {
  buildFertilitySummary,
  completeFertilityDimensions,
  getFertilityDimensionPairs,
} from "./dimension-analysis.js";
import {
  buildFertilityReportFileName,
  buildFertilityReportTitle,
  renderFertilityHtmlReport,
  renderFertilityMarkdownReport,
} from "./report-renderer.js";

const withUpdatedState = (
  session: StoredSkillFlowSession,
  state: ReturnType<typeof toFertilityAssessmentState>,
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
    const profile = resolveFertilityServiceProfile(assessment.facts);
    const scopeFlags = getFertilityScopeFlags(profile.assessmentScope);
    const dimensionPairs = getFertilityDimensionPairs(profile.assessmentScope);
    const dimensions = await completeFertilityDimensions(assessment, dimensionPairs);
    const withDimensions = {
      ...assessment,
      dimensions,
    };
    const summary = await buildFertilitySummary(withDimensions);
    const reportState = {
      ...withDimensions,
      summary,
    };
    const generatedAt = new Date().toISOString();
    const html = renderFertilityHtmlReport({
      state: reportState,
      profile,
      generatedAt,
    });
    const report = {
      markdown: renderFertilityMarkdownReport({
        state: reportState,
        profile,
        generatedAt,
      }),
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

    return {
      session: { ...nextSession, lastDirective: directive },
      directive,
    };
  },
};
