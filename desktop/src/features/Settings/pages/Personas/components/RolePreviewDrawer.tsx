import { Bot } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import CodeBlock from "@/shared/ui/CodeBlock";
import Drawer from "@/shared/ui/Drawer";
import { TextInput } from "@/shared/ui/Input";
import type { RolePreviewMode } from "../types";
import { useRoleTranslation } from "../i18n/useRoleTranslation";
import RolePreviewChat from "./RolePreviewChat";

interface RolePreviewDrawerProps {
  open: boolean;
  mode: RolePreviewMode;
  testInput: string;
  roleName: string;
  roleAvatarSrc: string | null;
  previewChatReply: string;
  assistantTypingLabel: string;
  previewPrompt: string;
  onClose: () => void;
  onModeChange: (mode: RolePreviewMode) => void;
  onTestInputChange: (value: string) => void;
}

export default function RolePreviewDrawer({
  open,
  mode,
  testInput,
  roleName,
  roleAvatarSrc,
  previewChatReply,
  assistantTypingLabel,
  previewPrompt,
  onClose,
  onModeChange,
  onTestInputChange,
}: RolePreviewDrawerProps) {
  const t = useRoleTranslation();

  const modeButtonClassName = (isActive: boolean) =>
    `rounded-ui-control border px-3 py-2 text-left text-sm font-medium transition-colors ${
      isActive
        ? "border-primary/25 bg-primary/10 text-primary"
        : "border-border bg-surface-secondary text-text-secondary hover:bg-surface-primary hover:text-text-primary"
    }`;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      closeLabel={t("preview.close")}
      closeMaskLabel={t("preview.closeMask")}
      header={
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Bot className="h-4 w-4 text-icon-secondary" />
            {t("preview.title")}
          </div>
          <div className="text-xs leading-5 text-text-secondary">
            {t("preview.hint")}
          </div>
        </div>
      }
      footer={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onModeChange("chat")}
          >
            {t("preview.chat")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onModeChange("rag")}
          >
            {t("preview.rag")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onModeChange("chat")}
            className={modeButtonClassName(mode === "chat")}
          >
            {t("preview.chat")}
          </button>
          <button
            type="button"
            onClick={() => onModeChange("rag")}
            className={modeButtonClassName(mode === "rag")}
          >
            {t("preview.rag")}
          </button>
        </div>

        <TextInput
          label={t("preview.testInput")}
          value={testInput}
          onChange={onTestInputChange}
        />

        {mode === "chat" ? (
          <RolePreviewChat
            roleName={roleName}
            roleAvatarSrc={roleAvatarSrc}
            testInput={testInput}
            assistantReply={previewChatReply}
            assistantTypingLabel={assistantTypingLabel}
          />
        ) : (
          <CodeBlock tone="terminal" className="whitespace-pre-wrap">
            {previewPrompt}
          </CodeBlock>
        )}
      </div>
    </Drawer>
  );
}
