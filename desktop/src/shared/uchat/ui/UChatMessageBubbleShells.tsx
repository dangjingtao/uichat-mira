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
      className="mt-chat-avatar-top flex h-chat-avatar w-chat-avatar shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-secondary/72"
      aria-hidden="true"
    >
      <img
        src={avatarSrc}
        alt={name ?? ""}
        className="h-chat-avatar w-chat-avatar object-cover"
        draggable={false}
      />
    </div>
  );
}

// UChatUserBubbleShell wraps user messages with the current house style.
export function UChatUserBubbleShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-w-0 max-w-[min(100%,32rem)] flex-col items-end rounded-chat-bubble bg-surface-secondary px-chat-user-bubble-x py-chat-bubble-y text-chat-message-user text-text-primary transition-colors duration-150 xl:max-w-[min(100%,34rem)]">
      {children}
    </div>
  );
}

// UChatAssistantBubbleShell wraps assistant messages with the current house
// style while leaving message rendering itself runtime-driven.
export function UChatAssistantBubbleShell({ children }: PropsWithChildren) {
  return (
    <div
      data-uchat-assistant-bubble="true"
      className="block min-w-0 max-w-full w-full rounded-chat-bubble bg-[linear-gradient(180deg,rgba(var(--color-surface-primary),0.56)_0%,rgba(var(--color-surface-primary),0.32)_100%)] px-chat-assistant-bubble-x py-chat-bubble-y text-chat-message-assistant text-text-primary"
    >
      {children}
    </div>
  );
}
