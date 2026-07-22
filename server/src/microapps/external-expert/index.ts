import { externalExpertsRepository, type ExternalExpertProvider } from "@/db/repositories/external-experts.repository.js";
import { invokeWebBridge, WebBridgeInvocationError } from "@/routes/webbridge.js";

export type ExternalSessionRef = {
  kind: "conversation_id" | "url" | "provider_state";
  value: string;
};

export type ExpertReply = {
  provider: ExternalExpertProvider;
  sessionRef?: ExternalSessionRef;
  reply: string;
};

const PROVIDERS = new Set<ExternalExpertProvider>(["chatgpt", "kimi", "deepseek"]);

const assertProvider = (provider: string): ExternalExpertProvider => {
  if (!PROVIDERS.has(provider as ExternalExpertProvider)) {
    throw new Error(`不支持的外部专家 Provider：${provider}`);
  }
  return provider as ExternalExpertProvider;
};

const invoke = (input: {
  userId: number;
  tool: "expert.detect" | "expert.bind" | "expert.send_message";
  params: Record<string, unknown>;
}) => invokeWebBridge(input);

export const createExternalExpertService = () => {
  const runtimeBindings = new Map<string, number>();

  const getExpert = (id: string, userId: number) => {
    const expert = externalExpertsRepository.getById(id, userId);
    if (!expert) throw new Error("外部专家不存在");
    return expert;
  };

  return {
    list(userId: number) {
      return externalExpertsRepository.listByUser(userId);
    },

    create(input: { userId: number; name: string; provider: string }) {
      const name = input.name.trim();
      if (!name) throw new Error("专家名称不能为空");
      return externalExpertsRepository.create({
        userId: input.userId,
        name: name.slice(0, 80),
        provider: assertProvider(input.provider),
      });
    },

    async bind(input: { userId: number; expertId: string; tabId: number }) {
      const expert = getExpert(input.expertId, input.userId);
      const detected = await invoke({
        userId: input.userId,
        tool: "expert.detect",
        params: { provider: expert.provider, tabId: input.tabId },
      }) as { loggedIn?: boolean; accountLabel?: string };
      if (!detected?.loggedIn) {
        externalExpertsRepository.updateStatus(expert.id, input.userId, "expired");
        throw new Error("外部专家网页未登录或当前页面不可用");
      }
      const result = await invoke({
        userId: input.userId,
        tool: "expert.bind",
        params: { provider: expert.provider, tabId: input.tabId },
      }) as { sessionRef?: ExternalSessionRef; accountLabel?: string };
      if (!result?.sessionRef?.kind || !result.sessionRef.value) {
        throw new Error("外部专家网页未返回有效会话引用");
      }
      runtimeBindings.set(expert.id, input.tabId);
      return externalExpertsRepository.updateBinding({
        id: expert.id,
        userId: input.userId,
        externalSessionRef: result.sessionRef,
        accountLabel: result.accountLabel || detected.accountLabel,
        status: "ready",
      });
    },

    async consult(input: { userId: number; expertId: string; message: string }): Promise<ExpertReply> {
      const expert = getExpert(input.expertId, input.userId);
      const message = input.message.trim();
      if (!message) throw new Error("咨询内容不能为空");
      const tabId = runtimeBindings.get(expert.id);
      if (!tabId) throw new Error("请先为专家绑定当前网页会话");
      try {
        const result = await invoke({
          userId: input.userId,
          tool: "expert.send_message",
          params: {
            provider: expert.provider,
            tabId,
            sessionRef: expert.externalSessionRef,
            message: message.slice(0, 12000),
          },
        }) as ExpertReply;
        if (!result?.reply) throw new Error("外部专家没有返回回复");
        if (result.sessionRef) {
          externalExpertsRepository.updateBinding({
            id: expert.id,
            userId: input.userId,
            externalSessionRef: result.sessionRef,
            accountLabel: expert.accountLabel || undefined,
            status: "ready",
          });
        }
        return { ...result, provider: expert.provider };
      } catch (error) {
        if (error instanceof WebBridgeInvocationError && ["CHATGPT_LOGIN_REQUIRED", "CHATGPT_THREAD_UNAVAILABLE", "CHATGPT_PAGE_UNSUPPORTED"].includes(error.code)) {
          externalExpertsRepository.updateStatus(expert.id, input.userId, "expired");
        }
        throw error;
      }
    },
  };
};

export type ExternalExpertService = ReturnType<typeof createExternalExpertService>;
