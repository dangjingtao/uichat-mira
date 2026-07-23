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

export type ExternalExpertAction = "ask" | "continue" | "new_conversation";

export type ExternalExpertConversation =
  | "new"
  | { conversationId: string };

export type ExternalExpertConsultation = {
  answer: string;
  provider: ExternalExpertProvider;
  conversationId: string | null;
  status: "completed" | "ready";
  latencyMs: number;
};

export class ExternalExpertServiceError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly suggestedAction?: string | null;

  constructor(input: {
    code: string;
    message: string;
    retryable: boolean;
    suggestedAction?: string | null;
  }) {
    super(input.message);
    this.name = "ExternalExpertServiceError";
    this.code = input.code;
    this.retryable = input.retryable;
    if (input.suggestedAction !== undefined) {
      this.suggestedAction = input.suggestedAction;
    }
  }
}

const PROVIDERS = new Set<ExternalExpertProvider>(["chatgpt", "kimi", "deepseek"]);

const assertProvider = (provider: unknown): ExternalExpertProvider => {
  if (!PROVIDERS.has(provider as ExternalExpertProvider)) {
    throw new ExternalExpertServiceError({
      code: "EXTERNAL_EXPERT_PROVIDER_UNSUPPORTED",
      message: `不支持的外部专家 Provider：${String(provider)}`,
      retryable: false,
      suggestedAction: "选择已注册的外部专家 Provider",
    });
  }
  return provider as ExternalExpertProvider;
};

export type ExternalExpertRepository = Pick<
  typeof externalExpertsRepository,
  "listByUser" | "getById" | "create" | "updateBinding" | "updateConnection" | "updateStatus"
>;

export type ExternalExpertServiceDependencies = {
  repository?: ExternalExpertRepository;
  invokeWebBridge?: typeof invokeWebBridge;
};

const invoke = (
  bridge: typeof invokeWebBridge,
  input: {
    userId: number;
    tool: "expert.connect" | "expert.send_message";
    params: Record<string, unknown>;
    signal?: AbortSignal;
  },
) => bridge(input);

export const createExternalExpertService = (
  dependencies: ExternalExpertServiceDependencies = {},
) => {
  const repository = dependencies.repository ?? externalExpertsRepository;
  const bridge = dependencies.invokeWebBridge ?? invokeWebBridge;
  const runtimeBindings = new Map<string, number>();

  const getExpert = (id: string, userId: number) => {
    const expert = repository.getById(id, userId);
    if (!expert) throw new Error("外部专家不存在");
    return expert;
  };

  const getOrCreateExpert = (input: {
    userId: number;
    provider: ExternalExpertProvider;
  }) => {
    const existing = repository
      .listByUser(input.userId)
      .find((expert) => expert.provider === input.provider);
    return existing ?? repository.create({
      userId: input.userId,
      name: `${input.provider} 专家`,
      provider: input.provider,
    });
  };

  const connect = async (input: {
    userId: number;
    expertId: string;
    signal?: AbortSignal;
  }) => {
    const expert = getExpert(input.expertId, input.userId);
    const result = await invoke(bridge, {
      userId: input.userId,
      tool: "expert.connect",
      params: { provider: expert.provider },
      signal: input.signal,
    }) as { accountLabel?: string; tabId?: number };
    if (typeof result.tabId !== "number" || !Number.isInteger(result.tabId)) {
      throw new ExternalExpertServiceError({
        code: "EXPERT_CONNECTION_UNAVAILABLE",
        message: "触界未返回有效的外部专家标签页",
        retryable: true,
        suggestedAction: "确认触界扩展已连接后重新建立专家连接",
      });
    }
    runtimeBindings.set(expert.id, result.tabId);
    return repository.updateConnection({
      id: expert.id,
      userId: input.userId,
      accountLabel: result.accountLabel,
      status: "ready",
    });
  };

  const consult = async (input: {
    userId: number;
    expertId: string;
    message: string;
    signal?: AbortSignal;
  }): Promise<ExpertReply> => {
    const expert = getExpert(input.expertId, input.userId);
    const message = input.message.trim();
    if (!message) throw new Error("咨询内容不能为空");
    const tabId = runtimeBindings.get(expert.id);
    if (tabId === undefined) {
      throw new ExternalExpertServiceError({
        code: "EXPERT_CONNECTION_UNAVAILABLE",
        message: "外部专家网页连接不可用，请先建立新的专家连接",
        retryable: true,
        suggestedAction: "使用 new_conversation 建立新的外部专家连接",
      });
    }
    try {
      const result = await invoke(bridge, {
        userId: input.userId,
        tool: "expert.send_message",
        params: {
          provider: expert.provider,
          tabId,
          sessionRef: expert.externalSessionRef,
          message: message.slice(0, 12000),
        },
        signal: input.signal,
      }) as ExpertReply;
      if (!result?.reply) throw new Error("外部专家没有返回回复");
      if (result.sessionRef) {
        repository.updateBinding({
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
        repository.updateStatus(expert.id, input.userId, "expired");
      }
      throw error;
    }
  };

  const ask = async (input: {
    userId: number;
    provider: string;
    action: ExternalExpertAction;
    question?: string;
    conversation?: ExternalExpertConversation;
    signal?: AbortSignal;
  }): Promise<ExternalExpertConsultation> => {
    const startedAt = Date.now();
    const provider = assertProvider(input.provider);
    if (!["ask", "continue", "new_conversation"].includes(input.action)) {
      throw new ExternalExpertServiceError({
        code: "EXTERNAL_EXPERT_ACTION_UNSUPPORTED",
        message: `不支持的外部专家动作：${String(input.action)}`,
        retryable: false,
        suggestedAction: "使用 ask、continue 或 new_conversation",
      });
    }
    const question = typeof input.question === "string" ? input.question.trim() : "";
    if (!question && input.action !== "new_conversation") {
      throw new ExternalExpertServiceError({
        code: "EXTERNAL_EXPERT_QUESTION_REQUIRED",
        message: "ask_external_expert 需要 question",
        retryable: false,
        suggestedAction: "提供要咨询外部专家的问题",
      });
    }
    const expert = getOrCreateExpert({ userId: input.userId, provider });
    const conversation = input.conversation;
    const requestedConversationId =
      conversation && typeof conversation === "object"
        ? typeof conversation.conversationId === "string" && conversation.conversationId.trim()
          ? conversation.conversationId.trim()
          : undefined
        : undefined;

    if (conversation && typeof conversation === "object" && !requestedConversationId) {
      throw new ExternalExpertServiceError({
        code: "CONVERSATION_MISMATCH",
        message: "conversation.conversationId 不能为空",
        retryable: false,
        suggestedAction: "传入有效的外部专家 conversationId，或使用 new",
      });
    }

    if (conversation === "new" && input.action === "continue") {
      throw new ExternalExpertServiceError({
        code: "CONVERSATION_MISMATCH",
        message: "continue 必须指定已有的外部专家会话",
        retryable: false,
        suggestedAction: "改用 new_conversation 建立新的外部专家会话",
      });
    }
    if (input.action === "continue" && !requestedConversationId) {
      throw new ExternalExpertServiceError({
        code: "CONVERSATION_MISMATCH",
        message: "continue 必须指定 conversation.conversationId",
        retryable: false,
        suggestedAction: "传入已有的外部专家 conversationId",
      });
    }
    if (input.action === "new_conversation" && requestedConversationId) {
      throw new ExternalExpertServiceError({
        code: "CONVERSATION_MISMATCH",
        message: "new_conversation 不能指定已有的 conversationId",
        retryable: false,
        suggestedAction: "移除已有 conversationId，或改用 continue",
      });
    }

    const mustCreateNewConversation =
      input.action === "new_conversation" || conversation === "new";
    if (mustCreateNewConversation) {
      await connect({
        userId: input.userId,
        expertId: expert.id,
        signal: input.signal,
      });
    } else if (requestedConversationId) {
      const current = repository.getById(expert.id, input.userId);
      if (!current?.externalSessionRef || current.externalSessionRef.value !== requestedConversationId) {
        throw new ExternalExpertServiceError({
          code: "CONVERSATION_MISMATCH",
          message: "请求的外部专家会话与当前专家绑定不一致",
          retryable: false,
          suggestedAction: "使用当前 conversationId，或改用 new_conversation",
        });
      }
    } else if (runtimeBindings.get(expert.id) === undefined) {
      // Agent requests have no separate UI connect step. When no live runtime
      // binding exists, ask starts a fresh provider page rather than reviving
      // an old tab or thread.
      await connect({
        userId: input.userId,
        expertId: expert.id,
        signal: input.signal,
      });
    }

    if (!question) {
      return {
        answer: "",
        provider,
        conversationId: null,
        status: "ready",
        latencyMs: Date.now() - startedAt,
      };
    }

    const reply = await consult({
      userId: input.userId,
      expertId: expert.id,
      message: question,
      signal: input.signal,
    });
    const current = repository.getById(expert.id, input.userId);
    return {
      answer: reply.reply,
      provider,
      conversationId: reply.sessionRef?.value ?? current?.externalSessionRef?.value ?? null,
      status: "completed",
      latencyMs: Date.now() - startedAt,
    };
  };

  return {
    list(userId: number) {
      return repository.listByUser(userId);
    },

    create(input: { userId: number; name: string; provider: string }) {
      const name = input.name.trim();
      if (!name) throw new Error("专家名称不能为空");
      const provider = assertProvider(input.provider);
      const existing = repository.listByUser(input.userId).find((expert) => expert.provider === provider);
      if (existing) return existing;
      return repository.create({
        userId: input.userId,
        name: name.slice(0, 80),
        provider,
      });
    },
    connect,
    consult,
    ask,
  };
};

export type ExternalExpertService = ReturnType<typeof createExternalExpertService>;

export const externalExpertService = createExternalExpertService();
