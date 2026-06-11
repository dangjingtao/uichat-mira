import { useMemo } from "react";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Database,
  LogOut,
  MessageSquare,
  Server,
  User,
} from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRuntimeHealth } from "../../system/hooks/useRuntimeHealth";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import {
  getRuntimeDescription,
  getRuntimeDisplayLabel,
} from "@/shared/platform/desktopRuntime";

function HomePage() {
  const { session, logout } = useAuth();
  const { runtime, backendState, databaseState } = useRuntimeHealth();
  const navigate = useNavigate();

  const runtimeLabel = useMemo(() => {
    return getRuntimeDisplayLabel(runtime);
  }, [runtime]);
  const runtimeDescription = useMemo(() => {
    return getRuntimeDescription(runtime);
  }, [runtime]);

  const backendSummary = useMemo(() => {
    return runtime.backendUrl || backendState.detail;
  }, [backendState.detail, runtime.backendUrl]);

  const toChat = () => navigate("/chat");

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-border bg-surface-primary shadow-shadow-sm">
          <div className="flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl space-y-3">
                <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {runtimeLabel}
                </div>
                <div className="space-y-2">
                  <h1 className="text-[28px] font-semibold leading-tight text-text-primary">
                    欢迎回来，{session.user.username}
                  </h1>
                </div>
              </div>

              <div className="flex w-32 items-center gap-3 self-start rounded-xl border border-border bg-surface-secondary px-3 py-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-primary">
                  <User className="h-4 w-4 text-icon-secondary" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-text-primary">
                    {session.user.username}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {session.user.role}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={toChat} className="gap-2">
                <MessageSquare className="h-4 w-4" />
                开始测试
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => logout()}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </Button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card label="后端服务" interactive className="h-full">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary">
                  <Server className="h-5 w-5 text-icon-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-text-primary">
                      后端服务
                    </h2>
                    <StatusIndicator status={backendState.status} />
                  </div>
                  <p className="text-sm leading-6 text-text-secondary">
                    {backendState.detail}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface-secondary px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  Endpoint
                </div>
                <div className="mt-1 break-all text-sm text-text-primary">
                  {backendSummary}
                </div>
              </div>
            </div>
          </Card>

          <Card label="数据库连接" interactive className="h-full">
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-secondary">
                  <Database className="h-5 w-5 text-icon-primary" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-text-primary">
                      数据库连接
                    </h2>
                    <StatusIndicator status={databaseState.status} />
                  </div>
                  <p className="text-sm leading-6 text-text-secondary">
                    {databaseState.detail}
                  </p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface-secondary px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                  Runtime
                </div>
                <div className="mt-1 text-sm text-text-primary">
                  {runtimeDescription}
                </div>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}

export default HomePage;
