import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LaptopMinimal, LogOut, Orbit, TabletSmartphone, User } from "lucide-react";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRuntimeHealth } from "../../system/hooks/useRuntimeHealth";
import { Button } from "@/shared/ui/Button";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import {
  getRuntimeDescription,
  getRuntimeDisplayLabel,
} from "@/shared/platform/desktopRuntime";

function HomePage() {
  const { t } = useTranslation();
  const { session, logout } = useAuth();
  const { runtime, backendState, databaseState } = useRuntimeHealth();
  const navigate = useNavigate();

  const runtimeLabel = useMemo(() => {
    return getRuntimeDisplayLabel(runtime);
  }, [runtime]);
  const runtimeDescription = useMemo(() => {
    return getRuntimeDescription(runtime);
  }, [runtime]);
  const RuntimeIcon = useMemo(() => {
    if (runtime.hostKind === "electron") {
      return LaptopMinimal;
    }

    if (runtime.hostKind === "tauri") {
      return TabletSmartphone;
    }

    return Orbit;
  }, [runtime.hostKind]);

  const backendSummary = useMemo(() => {
    return runtime.backendUrl || backendState.detail;
  }, [backendState.detail, runtime.backendUrl]);

  const statusItems = useMemo(
    () => [
      {
        key: "backend",
        label: t("dashboard.home.backendService"),
        status: backendState.status,
        value: backendSummary,
      },
      {
        key: "database",
        label: t("dashboard.home.databaseConnection"),
        status: databaseState.status,
        value: databaseState.detail,
      },
      {
        key: "runtime",
        label: t("dashboard.home.runtime"),
        status: backendState.status,
        value: runtimeDescription,
      },
    ],
    [
      t,
      backendState.status,
      backendSummary,
      databaseState.status,
      databaseState.detail,
      runtimeDescription,
    ],
  );

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface-secondary">
      <main className="mx-auto flex max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-ui-panel border border-border/80 bg-surface-primary shadow-[0_18px_48px_rgba(68,52,35,0.06)]">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(var(--color-primary),0.06)_0%,rgba(var(--color-primary),0.015)_52%,transparent_100%)]"
            />
            <div className="relative px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
              <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-6 lg:gap-8">
                <div className="min-w-0 flex-1 space-y-5">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1 text-xs font-medium tracking-[0.08em] text-primary">
                    <RuntimeIcon className="h-3.5 w-3.5" />
                    <span>{runtimeLabel}</span>
                  </div>

                  <div className="space-y-3">
                    <h1 className="max-w-[12ch] text-[34px] font-semibold leading-[1.12] tracking-[-0.03em] text-text-primary sm:text-[42px]">
                      {t("dashboard.home.welcomeBack", {
                        username: session.user.username,
                      })}
                    </h1>
                    <p className="max-w-2xl text-[15px] leading-7 text-text-secondary">
                      {t("dashboard.home.subtitle")}
                    </p>
                  </div>

                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <Button
                      variant="danger-outline"
                      onClick={() => logout()}
                      size="lg"
                      className="gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      {t("dashboard.home.logout")}
                    </Button>
                  </div>
                </div>

                <div className="w-full shrink-0 border-l-0 border-border/70 pt-0 md:w-[280px] md:border-l md:pl-6 lg:pl-8">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-surface-secondary px-3 py-1 text-xs font-medium text-text-secondary">
                      <span>{t("dashboard.home.currentUser")}</span>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border/80 bg-surface-primary text-icon-secondary">
                        <User className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[18px] font-semibold text-text-primary">
                          {session.user.username}
                        </div>
                        <div className="mt-1 text-sm text-text-secondary">
                          {session.user.role}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border/70 bg-[linear-gradient(180deg,rgba(var(--color-surface-secondary),0.88)_0%,rgba(var(--color-surface-primary),0.94)_100%)] px-6 py-4 sm:px-8 lg:px-10">
            <div className="grid gap-3 lg:grid-cols-3 lg:gap-6">
              {statusItems.map((item) => (
                <div
                  key={item.key}
                  className="flex items-start gap-3 border-b border-border/55 py-2 last:border-b-0 lg:border-b-0 lg:border-r lg:border-border/60 lg:pr-6 lg:last:border-r-0"
                >
                  <StatusIndicator status={item.status} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                      {item.label}
                    </div>
                    <div className="mt-1 line-clamp-2 text-sm leading-6 text-text-primary">
                      {item.value || "—"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

export default HomePage;
