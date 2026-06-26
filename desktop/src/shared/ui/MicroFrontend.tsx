import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

export interface MicroFrontendProps {
  /** iframe 加载的完整 URL */
  src: string;
  /** 面板标题 */
  title?: React.ReactNode;
  /** 自定义右侧辅助内容 */
  headerAside?: React.ReactNode;
  /** 面板高度，默认 360px */
  height?: string | number;
  /** 报告不存在时的提示文案 */
  emptyText?: React.ReactNode;
  /** 加载失败时的提示文案 */
  errorText?: React.ReactNode;
  /** 是否在加载阶段显示占位，默认 true */
  checkExists?: boolean;
  className?: string;
  iframeClassName?: string;
}

interface LoadState {
  status: "checking" | "ready" | "empty" | "error";
  error?: string;
}

function formatHeight(value?: string | number): string {
  if (value === undefined) {
    return "360px";
  }
  if (typeof value === "number") {
    return `${value}px`;
  }
  return value;
}

export default function MicroFrontend({
  src,
  title,
  headerAside,
  height,
  emptyText = "内容暂不可用",
  errorText = "内容加载失败",
  checkExists = true,
  className = "",
  iframeClassName = "",
}: MicroFrontendProps) {
  const [state, setState] = useState<LoadState>({
    status: checkExists ? "checking" : "ready",
  });

  useEffect(() => {
    if (!checkExists) {
      setState({ status: "ready" });
      return;
    }

    let cancelled = false;
    setState({ status: "checking" });

    fetch(src, { method: "HEAD" })
      .then((res) => {
        if (cancelled) {
          return;
        }
        setState({ status: res.ok ? "ready" : "empty" });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [src, checkExists]);

  const openExternal = () => {
    window.open(src, "_blank", "noopener,noreferrer");
  };

  const renderHeader = () => {
    if (!title && !headerAside) {
      return null;
    }

    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {title ? (
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {headerAside}
          <button
            type="button"
            onClick={openExternal}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
            aria-label="在新窗口打开"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const renderBody = () => {
    if (state.status === "checking") {
      return (
        <div className="flex h-full items-center justify-center text-sm text-text-secondary">
          加载中…
        </div>
      );
    }

    if (state.status === "error") {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 px-4 text-sm text-danger">
          <span>{errorText}</span>
          {state.error ? (
            <span className="text-xs text-text-tertiary">{state.error}</span>
          ) : null}
        </div>
      );
    }

    if (state.status === "empty") {
      return (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm text-text-secondary">
          {emptyText}
        </div>
      );
    }

    return (
      <iframe
        src={src}
        title={typeof title === "string" ? title : "micro-frontend"}
        className={`h-full w-full border-0 ${iframeClassName}`}
        sandbox="allow-scripts allow-same-origin allow-popups"
      />
    );
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {renderHeader()}
      <div
        className="overflow-hidden rounded-ui-panel border border-border/70 bg-surface-primary"
        style={{ height: formatHeight(height) }}
      >
        {renderBody()}
      </div>
    </div>
  );
}
