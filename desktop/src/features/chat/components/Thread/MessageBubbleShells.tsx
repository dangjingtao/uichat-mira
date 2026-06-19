import type { PropsWithChildren } from "react";
import { useThemePreferences } from "@/app/providers/ThemeProvider";
import pilotWarmNeutralAvatar from "@/assets/assistant-avatars/pilot-a-warm-neutral.png";
import pilotKnowledgeBlueAvatar from "@/assets/assistant-avatars/pilot-a-knowledge-blue.png";
import pilotArchiveGreenAvatar from "@/assets/assistant-avatars/pilot-a-archive-green.png";
import pilotSlateOceanAvatar from "@/assets/assistant-avatars/pilot-a-slate-ocean.png";

const pilotAssistantAvatarMap = {
  "warm-neutral": pilotWarmNeutralAvatar,
  "knowledge-blue": pilotKnowledgeBlueAvatar,
  "archive-green": pilotArchiveGreenAvatar,
  "slate-ocean": pilotSlateOceanAvatar,
} as const;

export function AssistantAvatar() {
  const { colorTheme } = useThemePreferences();
  const avatarSrc =
    pilotAssistantAvatarMap[colorTheme] ??
    pilotAssistantAvatarMap["warm-neutral"];

  return (
    <div
      className="mt-[10px] flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary/72"
      aria-hidden="true"
    >
      <img
        src={avatarSrc}
        alt=""
        className="h-9 w-9 object-cover"
        draggable={false}
      />
    </div>
  );
}

export function UserBubbleShell({ children }: PropsWithChildren) {
  return (
    <div className="max-w-[min(100%,32rem)] rounded-[14px] bg-surface-secondary px-4 py-2.5 text-[15px] leading-[1.7] text-text-primary transition-colors duration-150 xl:max-w-[min(100%,34rem)]">
      {children}
    </div>
  );
}

export function AssistantBubbleShell({ children }: PropsWithChildren) {
  return (
    <div className="block w-full rounded-[14px] bg-[linear-gradient(180deg,rgba(var(--color-surface-primary),0.56)_0%,rgba(var(--color-surface-primary),0.32)_100%)] px-1 py-2.5 text-[15px] leading-[1.72] text-text-primary">
      {children}
    </div>
  );
}
