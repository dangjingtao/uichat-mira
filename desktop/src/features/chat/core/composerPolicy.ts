import { useTranslation } from "react-i18next";

// useUChatComposerState centralizes app-specific composer gating rules layered
// on top of the protocol-agnostic uchat runtime.
export function useUChatComposerState({
  isRunning,
  hasKnowledgeBase,
  hasDefaultLlm,
  hasDefaultEmbedding,
}: {
  isRunning: boolean;
  hasKnowledgeBase: boolean;
  hasDefaultLlm: boolean;
  hasDefaultEmbedding: boolean;
}) {
  const { t } = useTranslation();
  const isSendDisabled =
    isRunning || !hasDefaultLlm || (hasKnowledgeBase && !hasDefaultEmbedding);

  const placeholder = isRunning
    ? t("chat.thread.composer.thinking")
    : !hasDefaultLlm
      ? t("chat.thread.composer.configureLlm")
      : hasKnowledgeBase && !hasDefaultEmbedding
        ? t("chat.thread.composer.configureEmbedding")
        : t("chat.thread.composer.inputPlaceholder");

  return {
    isSendDisabled,
    placeholder,
  };
}
