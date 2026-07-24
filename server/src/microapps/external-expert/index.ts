import { externalExpertsRepository, type ExternalExpertProvider } from "@/db/repositories/external-experts.repository.js";
import { invokeWebBridge, WebBridgeInvocationError } from "@/routes/webbridge.js";
import { threadService } from "@/services/thread.service.js";

export type ExternalSessionRef = {
  kind: "conversation_id" | "url" | "provider_state";
  value: string;
};

export type ExpertReply = {
  provider: ExternalExpertProvider;
  sessionRef?: ExternalSessionRef;
  reply: string;
};

export type ExternalExpertAdvice = {
  answer: string;
  status: "completed";
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
const DEFAULT_AGENT_PROVIDER: ExternalExpertProvider = "chatgpt";
const MAX_AGENT_QUESTION_CHARS = 8_000;
const MAX_AGENT_CONTEXT_CHARS = 3_000;
const INVALID_RUNTIME_CONNECTION_CODES = new Set([
  "BRIDGE_DISCONNECTED",
  "CHATGPT_LOGIN_REQUIRED",
  "CHATGPT_NEW_THREAD_UNAVAILABLE",
  "CHATGPT_PAGE_UNAVAILABLE",
  "CHATGPT_PAGE_UNSUPPORTED",
  "CHATGPT_TAB_UNAVAILABLE",
  "CHATGPT_THREAD_UNAVAILABLE",
]);

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
  resolveThreadContext?: (input: {
    userId: number;
    threadId?: string;
  }) => string | null | undefined;
};

const resolveDefaultThreadContext = (input: {
  userId: number;
  threadId?: string;
}) => {
  if (!input.threadId) return null;
  return threadService.getThreadSummaryById(input.threadId, input.userId)?.contextSummary;
};

const normalizeThreadContext = (context?: string | null) =>
  context?.trim().slice(0, MAX_AGENT_CONTEXT_CHARS) || null;

const buildExpertMessage = (input: { question: string; context?: string | null }) => {
  const context = normalizeThreadContext(input.context);
  if (!context) return input.question;
  return [
    "[Mira consultation context]",
    context,
    "[End Mira consultation context]",
    "",
    "Question:",
    input.question,
  ].join("\n");
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
  const resolveThreadContext =
    dependencies.resolveThreadContext ?? resolveDefaultThreadContext;
  const runtimeBindings = new Map<string, number>();
  const agentRuntimeBindings = new Map<number, string>();
  const appliedThreadContexts = new Map<string, string>();

  const getExpert = (id: string, userId: number) => {
    const expert = repository.getById(id, userId);
    if (!expert) throw new Error("外部专家不存在");
    return expert;
  };

  const isAgentAvailable = (userId: number) => {
    const expertId = agentRuntimeBindings.get(userId);
    return expertId !== undefined && runtimeBindings.has(expertId);
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
    const connectedExpert = repository.updateConnection({
      id: expert.id,
      userId: input.userId,
      accountLabel: result.accountLabel,
      status: "ready",
    });
    runtimeBindings.set(expert.id, result.tabId);
    if (expert.provider === DEFAULT_AGENT_PROVIDER) {
      agentRuntimeBindings.set(input.userId, expert.id);
    }
    appliedThreadContexts.delete(expert.id);
    return connectedExpert;
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
        message: "外部专家网页连接不可用，请先在问策界面创建连接",
        retryable: true,
        suggestedAction: "打开问策界面并点击创建连接",
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
      if (
        error instanceof WebBridgeInvocationError
        && INVALID_RUNTIME_CONNECTION_CODES.has(error.code)
      ) {
        runtimeBindings.delete(expert.id);
        if (agentRuntimeBindings.get(input.userId) === expert.id) {
          agentRuntimeBindings.delete(input.userId);
        }
        appliedThreadContexts.delete(expert.id);
        repository.updateStatus(expert.id, input.userId, "expired");
      }
      throw error;
    }
  };

  const ask = async (input: {
    userId: number;
    question: string;
    threadId?: string;
    signal?: AbortSignal;
  }): Promise<ExternalExpertAdvice> => {
    const startedAt = Date.now();
    const question = input.question.trim();
    if (!question) {
      throw new ExternalExpertServiceError({
        code: "EXTERNAL_EXPERT_QUESTION_REQUIRED",
        message: "ask_external_expert 需要 question",
        retryable: false,
        suggestedAction: "提供要咨询外部专家的问题",
      });
    }
    if (question.length > MAX_AGENT_QUESTION_CHARS) {
      throw new ExternalExpertServiceError({
        code: "EXTERNAL_EXPERT_QUESTION_TOO_LONG",
        message: `咨询内容不能超过 ${MAX_AGENT_QUESTION_CHARS} 个字符`,
        retryable: false,
        suggestedAction: "缩短问题后重新咨询",
      });
    }

    const expertId = agentRuntimeBindings.get(input.userId);
    const expert = expertId ? repository.getById(expertId, input.userId) : null;
    if (!expert || !runtimeBindings.has(expert.id)) {
      agentRuntimeBindings.delete(input.userId);
      throw new ExternalExpertServiceError({
        code: "EXPERT_CONNECTION_UNAVAILABLE",
        message: "外部专家网页连接不可用，请先在问策界面创建连接",
        retryable: true,
        suggestedAction: "打开问策界面并点击创建连接",
      });
    }

    const threadContext = normalizeThreadContext(resolveThreadContext({
      userId: input.userId,
      threadId: input.threadId,
    }));
    const appendContext =
      threadContext && appliedThreadContexts.get(expert.id) !== threadContext;
    const reply = await consult({
      userId: input.userId,
      expertId: expert.id,
      message: buildExpertMessage({
        question,
        context: appendContext ? threadContext : null,
      }),
      signal: input.signal,
    });
    if (appendContext) {
      appliedThreadContexts.set(expert.id, threadContext);
    }
    return {
      answer: reply.reply,
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
    isAgentAvailable,
  };
};

export type ExternalExpertService = ReturnType<typeof createExternalExpertService>;

export const externalExpertService = createExternalExpertService();
