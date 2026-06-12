import React from "react";
import { isRouteErrorResponse, useRouteError } from "react-router-dom";
import { Button } from "./Button";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
  resetKey: number;
};

const getErrorMessage = (error: Error | null) => {
  if (!error) {
    return "界面遇到了一点问题。";
  }

  return error.message.trim() || "发生了未知错误。";
};

type ErrorFallbackProps = {
  title?: string;
  message: string;
  detail?: string;
  onRetry?: () => void;
  onReload?: () => void;
};

function ErrorFallback({
  title = "页面暂时出了点问题",
  message,
  detail,
  onRetry,
  onReload,
}: ErrorFallbackProps) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-secondary px-6 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(var(--color-primary),0.12),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(var(--color-secondary),0.12),transparent_30%)]" />

      <section className="relative w-full max-w-xl rounded-3xl border border-border/80 bg-surface-primary/95 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-surface-secondary text-lg font-semibold text-text-primary">
          !
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-text-tertiary">
            Error Boundary
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
            {title}
          </h1>
          <p className="max-w-lg text-sm leading-6 text-text-secondary">
            {message}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {onRetry ? (
            <Button variant="primary" onClick={onRetry}>
              重试
            </Button>
          ) : null}
          {onReload ? (
            <Button variant="outline" onClick={onReload}>
              刷新应用
            </Button>
          ) : null}
        </div>

        {detail ? (
          <details className="mt-6 rounded-2xl border border-border bg-surface-secondary/80 px-4 py-3 text-sm text-text-secondary">
            <summary className="cursor-pointer list-none font-medium text-text-primary">
              查看错误详情
            </summary>
            <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-text-secondary">
              {detail}
            </pre>
          </details>
        ) : null}
      </section>
    </main>
  );
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
    resetKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Unhandled renderer error", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState((currentState) => ({
      error: null,
      resetKey: currentState.resetKey + 1,
    }));
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { children } = this.props;
    const { error, resetKey } = this.state;

    if (error) {
      return (
        <ErrorFallback
          message={`${getErrorMessage(error)} 你可以先重试一次，或者直接刷新应用。`}
          detail={error.stack || error.message}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
        />
      );
    }

    return <React.Fragment key={resetKey}>{children}</React.Fragment>;
  }
}

export function RouteErrorBoundary() {
  const routeError = useRouteError();

  let message = "当前页面加载失败了。你可以先刷新应用，再试一次。";
  let detail = "";

  if (isRouteErrorResponse(routeError)) {
    message =
      typeof routeError.data === "string" && routeError.data.trim()
        ? routeError.data
        : `${routeError.status} ${routeError.statusText || "Route Error"}`;
    detail = `${routeError.status} ${routeError.statusText}\n${String(routeError.data ?? "")}`.trim();
  } else if (routeError instanceof Error) {
    message = getErrorMessage(routeError);
    detail = routeError.stack || routeError.message;
  } else if (routeError) {
    detail = String(routeError);
  }

  return (
    <ErrorFallback
      title="页面加载失败"
      message={message}
      detail={detail}
      onReload={() => window.location.reload()}
    />
  );
}
