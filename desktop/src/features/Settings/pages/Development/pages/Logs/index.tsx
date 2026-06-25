import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type RuntimeLogStreamEvent,
  streamRuntimeLogs,
} from "@/shared/api/logs";

const MAX_VISIBLE_LOG_LINES = 100;
const RETRY_DELAY_MS = 1500;

export const pushCappedLogEntries = (
  current: string[],
  incoming: string[],
  limit = MAX_VISIBLE_LOG_LINES,
) => [...current, ...incoming].slice(-limit);

type StreamStatus = "connecting" | "live" | "reconnecting" | "error";

const applyRuntimeLogEvent = (
  current: string[],
  event: RuntimeLogStreamEvent,
) => {
  if (event.type === "snapshot") {
    return event.entries.slice(-MAX_VISIBLE_LOG_LINES);
  }

  return pushCappedLogEntries(current, [event.entry], MAX_VISIBLE_LOG_LINES);
};

export default function DevelopmentLogs() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<string[]>([]);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let activeController: AbortController | null = null;

    const connect = async (attempt: "initial" | "retry") => {
      if (disposed) {
        return;
      }

      setStatus(attempt === "initial" ? "connecting" : "reconnecting");
      setErrorMessage(null);
      activeController = new AbortController();

      try {
        await streamRuntimeLogs(
          {
            signal: activeController.signal,
            limit: MAX_VISIBLE_LOG_LINES,
          },
          async (event) => {
            if (disposed) {
              return;
            }

            setStatus("live");
            setEntries((current) => applyRuntimeLogEvent(current, event));
          },
        );

        if (!disposed) {
          retryTimer = setTimeout(() => {
            void connect("retry");
          }, RETRY_DELAY_MS);
        }
      } catch (error) {
        if (disposed || activeController.signal.aborted) {
          return;
        }

        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : String(error),
        );
        retryTimer = setTimeout(() => {
          void connect("retry");
        }, RETRY_DELAY_MS);
      }
    };

    void connect("initial");

    return () => {
      disposed = true;
      activeController?.abort();
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, []);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "live":
        return t("settings.development.logs.status.live");
      case "reconnecting":
        return t("settings.development.logs.status.reconnecting");
      case "error":
        return t("settings.development.logs.status.error");
      default:
        return t("settings.development.logs.status.connecting");
    }
  }, [status, t]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            {t("settings.development.logs.title")}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {t("settings.development.logs.description")}
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface-primary px-3 py-1 text-xs text-text-secondary">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "live"
                ? "bg-emerald-500"
                : status === "error"
                  ? "bg-rose-500"
                  : "bg-amber-500"
            }`}
          />
          <span>{statusLabel}</span>
          <span className="text-text-tertiary">
            {t("settings.development.logs.limit", {
              count: MAX_VISIBLE_LOG_LINES,
            })}
          </span>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-[14px] border border-rose-200/70 bg-rose-50/80 px-4 py-3 text-sm text-rose-700">
          {t("settings.development.logs.errorPrefix")} {errorMessage}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden rounded-[18px] border border-border/70 bg-slate-950 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-white/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-slate-400">
            runtime tail
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {entries.length === 0 ? (
              <p className="text-sm text-slate-400">
                {t("settings.development.logs.empty")}
              </p>
            ) : (
              <pre className="font-mono text-xs leading-6 text-slate-100 whitespace-pre-wrap break-words">
                {entries.join("\n")}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
