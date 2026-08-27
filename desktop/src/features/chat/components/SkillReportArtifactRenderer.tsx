"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import type { ChatMessage } from "@/shared/uchat/core";
import {
  getSkillReportHtml,
  getSkillReportPdfBlob,
} from "@/shared/api/skillReports";

const REPORT_MARKER =
  /<!--mira-skill-report:([a-zA-Z0-9_-]+):(pdf|html)(?::([a-zA-Z0-9_-]+))?-->/;
const REPORT_FILENAME = "两个人的备孕全景报告.pdf";

export type SkillReportArtifactMarker = {
  sessionId: string;
  pdfAvailable: boolean;
  artifactKind: "fertility-report" | "wechat-article-layout";
};

export const readSkillReportArtifactMarker = (
  message: ChatMessage,
): SkillReportArtifactMarker | null => {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  const match = REPORT_MARKER.exec(text);
  if (!match?.[1]) return null;
  return {
    sessionId: match[1],
    pdfAvailable: match[2] === "pdf",
    artifactKind:
      match[3] === "wechat-article-layout"
        ? "wechat-article-layout"
        : "fertility-report",
  };
};

const resolvePresentation = (marker: SkillReportArtifactMarker) =>
  marker.artifactKind === "wechat-article-layout"
    ? {
        title: "公众号排版预览",
        subtitle: "HTML 行内预览 · 完整文件仍保留在工作区",
        loading: "正在加载排版预览…",
        badge: "HTML",
      }
    : {
        title: "两个人的备孕全景报告",
        subtitle: "行内预览 · PDF 与此内容一致",
        loading: "正在加载报告…",
        badge: marker.pdfAvailable ? null : "PDF 暂不可用",
      };

export function SkillReportArtifactRenderer({
  message,
}: {
  message: ChatMessage;
}) {
  const marker = useMemo(
    () => readSkillReportArtifactMarker(message),
    [message],
  );
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    if (!marker) return () => undefined;

    void getSkillReportHtml(message.threadId, marker.sessionId)
      .then((value) => {
        if (!cancelled) setHtml(value);
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error ? loadError.message : "HTML 预览加载失败",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [marker, message.threadId]);

  if (!marker) return null;
  const presentation = resolvePresentation(marker);

  const downloadPdf = async () => {
    if (!marker.pdfAvailable || downloading) return;
    setDownloading(true);
    setError(null);
    let objectUrl: string | null = null;
    try {
      const blob = await getSkillReportPdfBlob(
        message.threadId,
        marker.sessionId,
      );
      objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = REPORT_FILENAME;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : "PDF 下载失败",
      );
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setDownloading(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-surface-primary shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cloudy-2 text-text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-text-primary">
              {presentation.title}
            </div>
            <div className="truncate text-xs text-text-secondary">
              {presentation.subtitle}
            </div>
          </div>
        </div>
        {marker.pdfAvailable ? (
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={downloading}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-xs font-medium text-text-primary transition-colors hover:bg-cloudy-1 disabled:opacity-60"
          >
            {downloading ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            PDF
          </button>
        ) : presentation.badge ? (
          <span className="shrink-0 text-xs text-text-secondary">
            {presentation.badge}
          </span>
        ) : null}
      </header>

      {error ? (
        <div className="px-4 py-3 text-xs text-danger-text">{error}</div>
      ) : null}

      {!html && !error ? (
        <div className="flex h-24 items-center justify-center gap-2 text-sm text-text-secondary">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          {presentation.loading}
        </div>
      ) : null}

      {html ? (
        <iframe
          title={presentation.title}
          srcDoc={html}
          sandbox=""
          className="block h-[min(28vh,260px)] min-h-[190px] w-full border-0 bg-white"
        />
      ) : null}
    </section>
  );
}
