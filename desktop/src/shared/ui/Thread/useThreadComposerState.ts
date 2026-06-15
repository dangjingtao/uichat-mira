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
  const isSendDisabled =
    isRunning || !hasDefaultLlm || (ragEnabled && !hasDefaultEmbedding);

  const placeholder = isRunning
    ? "助手正在思考中..."
    : !hasDefaultLlm
      ? "请先配置默认 LLM..."
      : ragEnabled && !hasDefaultEmbedding
        ? "启用知识库前请先配置默认 Embedding..."
        : "输入问题，回车发送...";

  return {
    isSendDisabled,
    placeholder,
  };
}
