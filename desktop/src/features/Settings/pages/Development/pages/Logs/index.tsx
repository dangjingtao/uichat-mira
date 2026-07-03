import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Alert from "@/shared/ui/Alert";
import Card from "@/shared/ui/Card";
import TerminalPanel from "@/shared/ui/TerminalPanel";
import LogButtons from "@/features/Settings/pages/General/LogsButtons";
import {
  type RuntimeLogStreamEvent,
  streamRuntimeLogs,
} from "@/shared/api/logs";

const MAX_VISIBLE_LOG_LINES = 100;
const RETRY_DELAY_MS = 1500;
const CONNECTING_TERMINAL_LINE = "[connecting to runtime log stream...]";
const CONNECTING_SKELETON_LINES = [
  "> opening stream channel",
  "> requesting latest runtime snapshot",
  "> waiting for backend log tail",
];

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
      {errorMessage ? (
        <Alert variant="danger">
          {t("settings.development.logs.errorPrefix")} {errorMessage}
        </Alert>
      ) : null}

      <TerminalPanel
        title={t("settings.development.logs.terminalTitle")}
        badge={<LogButtons variant="link" />}
        meta={`${statusLabel} · ${t("settings.development.logs.limit", {
          count: MAX_VISIBLE_LOG_LINES,
        })}`}
      >
        {entries.length === 0 ? (
          status === "connecting" || status === "reconnecting" ? (
            <div className="space-y-3">
              <pre className="whitespace-pre-wrap break-words text-text-secondary">
                {CONNECTING_TERMINAL_LINE}
              </pre>
              <div className="space-y-2">
                {CONNECTING_SKELETON_LINES.map((line) => (
                  <Card
                    key={line}
                    variant="ghost"
                    padding="sm"
                    className="border border-dashed border-border/60 bg-surface-secondary/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-primary/70" />
                      <div className="h-3 w-40 animate-pulse rounded-full bg-surface-secondary" />
                      <span className="text-[11px] text-text-tertiary">
                        {line}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words text-text-secondary">
              {t("settings.development.logs.empty")}
            </pre>
          )
        ) : (
          <pre className="whitespace-pre-wrap break-words">
            {entries.join("\n")}
          </pre>
        )}
      </TerminalPanel>
    </div>
  );
}
