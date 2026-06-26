import {
  UChatAssistantAvatar,
  UChatAssistantBubbleShell,
  UChatUserBubbleShell,
} from "@/shared/uchat/ui/UChatMessageBubbleShells";
import { useRoleTranslation } from "../i18n/useRoleTranslation";

interface RolePreviewChatProps {
  roleName: string;
  roleAvatarSrc: string | null;
  testInput: string;
  assistantReply: string;
  assistantTypingLabel: string;
}

export default function RolePreviewChat({
  roleName,
  roleAvatarSrc,
  testInput,
  assistantReply,
  assistantTypingLabel,
}: RolePreviewChatProps) {
  const t = useRoleTranslation();

  return (
    <div className="rounded-ui-panel border border-border bg-surface-secondary/35 p-4">
      <div className="mb-4 text-xs leading-5 text-text-secondary">
        {t("preview.chatView.hint")}
      </div>

      <div className="space-y-4">
        <div className="flex justify-end">
          <UChatUserBubbleShell>
            <div className="whitespace-pre-wrap break-words">
              {testInput.trim() || t("defaults.previewInput")}
            </div>
          </UChatUserBubbleShell>
        </div>

        <div className="flex items-start gap-3">
          <UChatAssistantAvatar src={roleAvatarSrc} name={roleName} />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-semibold text-text-primary">
                {roleName}
              </span>
              <span className="text-xs text-text-secondary">
                {assistantTypingLabel}
              </span>
            </div>
            <UChatAssistantBubbleShell>
              <div className="whitespace-pre-wrap break-words px-3 py-0.5">
                {assistantReply}
              </div>
            </UChatAssistantBubbleShell>
          </div>
        </div>
      </div>
    </div>
  );
}
