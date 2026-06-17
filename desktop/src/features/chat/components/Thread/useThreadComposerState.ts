type UseThreadComposerStateInput = {
  isRunning: boolean;
  ragEnabled: boolean;
  hasDefaultLlm: boolean;
  hasDefaultEmbedding: boolean;
};

type ThreadComposerState = {
  isSendDisabled: boolean;
  placeholder: string;
};

export function useThreadComposerState({
  isRunning,
  ragEnabled,
  hasDefaultLlm,
  hasDefaultEmbedding,
}: UseThreadComposerStateInput): ThreadComposerState {
  const { t } = useTranslation();
  const isSendDisabled =
    isRunning || !hasDefaultLlm || (ragEnabled && !hasDefaultEmbedding);

  const placeholder = isRunning
    ? t("chat.thread.composer.thinking")
    : !hasDefaultLlm
      ? t("chat.thread.composer.configureLlm")
      : ragEnabled && !hasDefaultEmbedding
        ? t("chat.thread.composer.configureEmbedding")
        : t("chat.thread.composer.inputPlaceholder");

  return {
    isSendDisabled,
    placeholder,
  };
}
import { useTranslation } from "react-i18next";
