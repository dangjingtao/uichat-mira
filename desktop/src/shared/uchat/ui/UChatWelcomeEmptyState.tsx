"use client";

import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useThemePreferences } from "@/app/providers/ThemeProvider";
import welcomeAstronautHeroArchiveGreen from "@/assets/branding/welcome-astronaut-hero-archive-green.png";
import welcomeAstronautHeroKnowledgeBlue from "@/assets/branding/welcome-astronaut-hero-knowledge-blue.png";
import welcomeAstronautHeroSlateOcean from "@/assets/branding/welcome-astronaut-hero-slate-ocean.png";
import welcomeAstronautHero from "@/assets/branding/welcome-astronaut-hero.png";
import type { ThemePresetId } from "@/shared/theme/colorThemes";
import WelcomePanel from "@/shared/ui/WelcomePanel";

const welcomeHeroByTheme: Record<ThemePresetId, string> = {
  "warm-neutral": welcomeAstronautHero,
  "knowledge-blue": welcomeAstronautHeroKnowledgeBlue,
  "archive-green": welcomeAstronautHeroArchiveGreen,
  "slate-ocean": welcomeAstronautHeroSlateOcean,
};

// UChatWelcomeEmptyState is the shared empty-thread landing panel.
export function UChatWelcomeEmptyState({
  activeThreadId,
  isVisible,
}: {
  activeThreadId: string | null;
  isVisible: boolean;
}) {
  const { t } = useTranslation();
  const { colorTheme } = useThemePreferences();
  const welcomeHeroAsset =
    welcomeHeroByTheme[colorTheme] ?? welcomeHeroByTheme["warm-neutral"];

  return (
    <WelcomePanel
      visible={isVisible}
      stateKey={
        isVisible ? `welcome-${activeThreadId ?? "empty"}` : "welcome-hidden"
      }
      hero={
        <div className="pointer-events-none absolute inset-y-0 right-0 w-full lg:w-[64%]">
          <div
            aria-hidden="true"
            className="absolute inset-y-10 left-[10%] right-[2%] bg-[radial-gradient(circle_at_center,rgba(var(--color-primary),0.085),rgba(var(--color-primary),0.028)_40%,transparent_74%)] blur-3xl"
          />
          <div className="absolute inset-y-0 left-[4%] right-0 bg-[linear-gradient(90deg,rgba(var(--color-surface-secondary),0.98)_0%,rgba(var(--color-surface-secondary),0.9)_14%,rgba(var(--color-surface-secondary),0.42)_32%,rgba(var(--color-surface-secondary),0.08)_50%,transparent_66%)]" />
          <div
            className="absolute inset-y-0 left-[4%] right-0 overflow-hidden"
            style={{
              WebkitMaskImage:
                "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.2) 8%, rgba(0,0,0,0.88) 18%, #000 32%, #000 72%, rgba(0,0,0,0.84) 84%, rgba(0,0,0,0.24) 94%, transparent 100%), linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.22) 10%, rgba(0,0,0,0.92) 22%, #000 36%, #000 68%, rgba(0,0,0,0.86) 82%, rgba(0,0,0,0.22) 92%, transparent 100%)",
              WebkitMaskComposite: "source-in",
              maskImage:
                "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.2) 8%, rgba(0,0,0,0.88) 18%, #000 32%, #000 72%, rgba(0,0,0,0.84) 84%, rgba(0,0,0,0.24) 94%, transparent 100%), linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.22) 10%, rgba(0,0,0,0.92) 22%, #000 36%, #000 68%, rgba(0,0,0,0.86) 82%, rgba(0,0,0,0.22) 92%, transparent 100%)",
              maskComposite: "intersect",
            }}
          >
            <img
              src={welcomeHeroAsset}
              alt=""
              aria-hidden="true"
              className="absolute right-[-3%] top-[50%] w-[120%] max-w-none -translate-y-1/2 select-none object-contain opacity-[0.76] drop-shadow-[0_14px_26px_rgba(15,23,42,0.028)]"
              draggable={false}
            />
          </div>
          <div className="absolute inset-y-[20%] right-[0%] w-[24%] rounded-[24px] bg-[linear-gradient(180deg,rgba(var(--color-surface-primary),0.1),rgba(var(--color-surface-primary),0.04))] blur-[3px]" />
          <div className="absolute right-[5%] top-[18%] h-[4.5rem] w-[7.25rem] rounded-[18px] border border-border/14 bg-surface-primary/8 shadow-none" />
          <div className="absolute right-[0%] top-[32%] h-[4.8rem] w-[7.5rem] rounded-[18px] border border-border/12 bg-surface-primary/7 shadow-none" />
          <div className="absolute right-[2%] bottom-[21%] h-[5.4rem] w-[8rem] rounded-[18px] border border-border/10 bg-surface-primary/7 shadow-none" />
        </div>
      }
      badge={
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-surface-secondary/88 px-3 py-1 text-xs font-medium text-text-secondary">
          <Sparkles className="h-3.5 w-3.5" />
          <span>RAG Chat Tester</span>
        </div>
      }
      title={
        <>
          <span className="tracking-[0.04em]">
            {t("chat.thread.welcome.titlePrefix")}
            <span className="text-primary">
              {t("chat.thread.welcome.titleHighlight")}
            </span>
            {t("chat.thread.welcome.titleSuffix")}
          </span>
          <span className="mt-1 block tracking-[0.04em] text-text-secondary">
            {t("chat.thread.welcome.titleLine2")}
          </span>
        </>
      }
      description={t("chat.thread.welcome.description")}
    />
  );
}
