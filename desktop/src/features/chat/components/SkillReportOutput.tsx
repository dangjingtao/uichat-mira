"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, FileText, LoaderCircle } from "lucide-react";
import type { ChatMessage } from "@/shared/uchat/core";
import {
  getSkillReportHtml,
  getSkillReportPdfBlob,
} from "@/shared/api/skillReports";

const REPORT_MARKER = /<!--mira-skill-report:([a-zA-Z0-9_-]+):(pdf|html)-->/;
const REPORT_FILENAME = "两个人的备孕全景报告.pdf";

const readReportMarker = (message: ChatMessage) => {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
  const match = REPORT_MARKER.exec(text);
  if (!match?.[1]) return null;
  return {
    sessionId: match[1],
    pdfAvailable: match[2] === "pdf",
  };
};

export function SkillReportOutput({ message }: { message: ChatMessage }) {
  const marker = useMemo(() => readReportMarker(message), [message]);
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
            loadError instanceof Error ? loadError.message : "报告加载失败",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [marker, message.threadId]);

  if (!marker) return null;

  const downloadPdf = async () => {
    if (!marker.pdfAvailable || downloading) return;
    setDownloading(true);
    setError(null);
    let objectUrl: string | null = null;
    try {
      const blob = await getSkillReportPdfBlob(message.threadId, marker.sessionId);
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
    <section className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-surface-primary shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-cloudy-2 text-text-primary">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-text-primary">
              两个人的备孕全景报告
            </div>
            <div className="text-xs text-text-secondary">
              行内 HTML · 与 PDF 使用同一份报告内容
            </div>
          </div>
        </div>
        {marker.pdfAvailable ? (
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={downloading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-xs font-medium text-text-primary transition-colors hover:bg-cloudy-1 disabled:opacity-60"
          >
            {downloading ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            PDF
          </button>
        ) : (
          <span className="text-xs text-text-secondary">PDF 暂不可用</span>
        )}
      </header>

      {error ? (
        <div className="px-4 py-3 text-xs text-danger-text">{error}</div>
      ) : null}

      {!html && !error ? (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-text-secondary">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          正在加载报告…
        </div>
      ) : null}

      {html ? (
        <iframe
          title="两个人的备孕全景报告"
          srcDoc={html}
          sandbox=""
          className="block h-[min(76vh,860px)] min-h-[560px] w-full border-0 bg-white"
        />
      ) : null}
    </section>
  );
}
