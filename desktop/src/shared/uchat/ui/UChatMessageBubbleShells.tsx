import type { PropsWithChildren } from "react";
import { useThemePreferences } from "@/app/providers/ThemeProvider";
import pilotArchiveGreenAvatar from "@/assets/assistant-avatars/pilot-a-archive-green.png";
import pilotKnowledgeBlueAvatar from "@/assets/assistant-avatars/pilot-a-knowledge-blue.png";
import pilotSlateOceanAvatar from "@/assets/assistant-avatars/pilot-a-slate-ocean.png";
import pilotWarmNeutralAvatar from "@/assets/assistant-avatars/pilot-a-warm-neutral.png";

const pilotAssistantAvatarMap = {
  "warm-neutral": pilotWarmNeutralAvatar,
  "knowledge-blue": pilotKnowledgeBlueAvatar,
  "archive-green": pilotArchiveGreenAvatar,
  "slate-ocean": pilotSlateOceanAvatar,
} as const;

// UChatAssistantAvatar keeps the current brand avatar treatment in the shared
// UI layer so feature containers do not own any avatar markup.
export function UChatAssistantAvatar({
  src,
  name,
}: {
  src?: string | null;
  name?: string;
}) {
  const { colorTheme } = useThemePreferences();
  const avatarSrc =
    src ??
    pilotAssistantAvatarMap[colorTheme] ??
    pilotAssistantAvatarMap["warm-neutral"];

  return (
    <div
      className="mt-[10px] flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary/72"
      aria-hidden="true"
    >
      <img
        src={avatarSrc}
        alt={name ?? ""}
        className="h-9 w-9 object-cover"
        draggable={false}
      />
    </div>
  );
}

// UChatUserBubbleShell wraps user messages with the current house style.
export function UChatUserBubbleShell({ children }: PropsWithChildren) {
  return (
    <div className="flex max-w-[min(100%,32rem)] flex-col items-end rounded-[14px] bg-surface-secondary px-4 py-2.5 text-[15px] leading-[1.7] text-text-primary transition-colors duration-150 xl:max-w-[min(100%,34rem)]">
      {children}
    </div>
  );
}

// UChatAssistantBubbleShell wraps assistant messages with the current house
// style while leaving message rendering itself runtime-driven.
export function UChatAssistantBubbleShell({ children }: PropsWithChildren) {
  return (
    <div className="block w-full rounded-[14px] bg-[linear-gradient(180deg,rgba(var(--color-surface-primary),0.56)_0%,rgba(var(--color-surface-primary),0.32)_100%)] px-1 py-2.5 text-[15px] leading-[1.72] text-text-primary">
      {children}
    </div>
  );
}
