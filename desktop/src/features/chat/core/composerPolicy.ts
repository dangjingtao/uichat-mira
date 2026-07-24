import { useTranslation } from "react-i18next";

// useUChatComposerState centralizes app-specific composer gating rules layered
// on top of the protocol-agnostic uchat runtime.
export function useUChatComposerState({
  hasRunningTask,
  isCurrentThreadRunning,
  hasKnowledgeBase,
  hasDefaultLlm,
  hasDefaultEmbedding,
}: {
  hasRunningTask: boolean;
  isCurrentThreadRunning: boolean;
  hasKnowledgeBase: boolean;
  hasDefaultLlm: boolean;
  hasDefaultEmbedding: boolean;
}) {
  const { t } = useTranslation();
  const isComposerDisabled =
    isCurrentThreadRunning ||
    !hasDefaultLlm ||
    (hasKnowledgeBase && !hasDefaultEmbedding);
  const isSendDisabled =
    hasRunningTask || !hasDefaultLlm || (hasKnowledgeBase && !hasDefaultEmbedding);

  const placeholder = isCurrentThreadRunning
    ? t("chat.thread.composer.thinking")
    : !hasDefaultLlm
      ? t("chat.thread.composer.configureLlm")
      : hasKnowledgeBase && !hasDefaultEmbedding
        ? t("chat.thread.composer.configureEmbedding")
        : t("chat.thread.composer.inputPlaceholder");

  return {
    isComposerDisabled,
    isSendDisabled,
    placeholder,
  };
}
