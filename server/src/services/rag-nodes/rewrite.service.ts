import {
  providerProxyService,
  type NormalizedChatMessage,
} from "@/services/provider-proxy.service/index.js";
import { ConversationTrimmer } from "@/services/conversation-trimmer.js";
import { writeStructuredLog } from "@/logger";
import type { RagNodeResult } from "@/services/rag-node-contract";
import {
  createModelEnvironment,
  createObservation,
  createResultEnvironment,
  withTiming,
} from "@/services/rag-node-observation";

export interface MaybeRewriteInput {
  question: string;
  conversationHistory?: NormalizedChatMessage[];
}

export interface MaybeRewriteOutput {
  question: string;
  retrievalQuestion: string;
  rewritten: boolean;
  reason: "short-follow-up" | "referential-follow-up" | "preserve-original";
}

export interface RewriteStatePatch {
  retrievalQuestion: string;
  queryRewritten: boolean;
  queryRewriteReason: string;
}

const FOLLOW_UP_REFERENCES = [
  "这个",
  "这个问题",
  "这个功能",
  "这个报错",
  "这个文件",
  "这个接口",
  "那个",
  "那个问题",
  "那个文件",
  "那个接口",
  "它",
  "它们",
  "他",
  "她",
  "上面",
  "前面",
  "刚才",
  "之前",
  "这里",
  "那里",
  "这些",
  "那些",
  "其",
  "该",
];

const sanitizeRewrite = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^["'`\s]+|["'`\s]+$/g, "")
    .replace(/^(检索问题|改写问题|重写问题|Rewrite|Query)\s*[:：]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

const looksLikeValidRewrite = (originalQuestion: string, rewrittenQuestion: string) => {
  if (!rewrittenQuestion) {
    return false;
  }

  const rewrittenLength = Array.from(rewrittenQuestion).length;
  if (rewrittenLength > 200) {
    return false;
  }

  const sentenceLikeSegments = rewrittenQuestion
    .split(/[。！？!?]+/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (sentenceLikeSegments.length > 1) {
    return false;
  }

  const suspiciousMarkers = [
    "根据现有知识库",
    "无法回答",
    "答案",
    "建议",
    "可以看出",
    "因此",
    "总结",
  ];

  if (suspiciousMarkers.some((marker) => rewrittenQuestion.includes(marker))) {
    return false;
  }

  return rewrittenLength <= Math.max(120, Array.from(originalQuestion).length * 3);
};

const RECENT_HISTORY_LIMIT = 6;

const getRecentHistory = (history?: NormalizedChatMessage[]) =>
  ConversationTrimmer.take(history ?? [], RECENT_HISTORY_LIMIT, "tail");

const shouldRewriteQuestion = (
  question: string,
  history?: NormalizedChatMessage[],
): MaybeRewriteOutput["reason"] => {
  const trimmed = question.trim();
  const hasHistory = (history?.length ?? 0) > 0;
  const charLength = Array.from(trimmed).length;

  if (
    hasHistory &&
    (charLength <= 14 || FOLLOW_UP_REFERENCES.some((item) => trimmed.includes(item)))
  ) {
    if (FOLLOW_UP_REFERENCES.some((item) => trimmed.includes(item))) {
      return "referential-follow-up";
    }

    return "short-follow-up";
  }

  return "preserve-original";
};

const buildRewriteMessages = (
  question: string,
  history?: NormalizedChatMessage[],
): NormalizedChatMessage[] => {
  const recentHistory = getRecentHistory(history);
  const historyText =
    recentHistory.length > 0
      ? recentHistory
          .map((message, index) => `${index + 1}. ${message.role}: ${message.content}`)
          .join("\n")
      : "无";

  return [
    {
      role: "system",
      content: [
        "你是一个 RAG 检索问题改写器。",
        "目标是把用户当前问题改写成更适合知识库检索的一句话查询。",
        "只输出最终查询，不要解释，不要加前缀，不要使用引号，不要回答问题本身。",
        "如果当前问题已经足够清晰，就原样输出。",
        "尽量补足上下文中的省略主语、对象、文件名、接口名、报错对象。",
        "保留原始术语、缩写、路径、类名、函数名、接口名。",
      ].join("\n"),
    },
    {
      role: "user",
      content: `最近对话：\n${historyText}\n\n当前问题：\n${question}\n\n请输出适合检索的最终查询。`,
    },
  ];
};

const rewriteWithTaskModel = async (
  question: string,
  history?: NormalizedChatMessage[],
) => {
  let rewritten = "";
  for await (const delta of providerProxyService.streamTaskChatText(
    buildRewriteMessages(question, history),
  )) {
    rewritten += delta;
  }

  return sanitizeRewrite(rewritten);
};

export const rewriteService = {
  async maybeRewrite(input: MaybeRewriteInput): Promise<MaybeRewriteOutput> {
    const question = input.question.trim();
    const reason = shouldRewriteQuestion(question, input.conversationHistory);

    if (reason === "preserve-original") {
      return {
        question,
        retrievalQuestion: question,
        rewritten: false,
        reason,
      };
    }

    try {
      const rewrittenQuestion = await rewriteWithTaskModel(
        question,
        input.conversationHistory,
      );

      const retrievalQuestion =
        looksLikeValidRewrite(question, rewrittenQuestion)
          ? rewrittenQuestion
          : question;
      const rewritten = retrievalQuestion !== question;

      writeStructuredLog("info", {
        scope: "rag-rewrite",
        event: rewritten ? "rewrite-applied" : "rewrite-skipped",
        reason,
        question,
        retrievalQuestion,
        conversationHistoryCount: input.conversationHistory?.length ?? 0,
      });

      return {
        question,
        retrievalQuestion,
        rewritten,
        reason,
      };
    } catch (error) {
      writeStructuredLog("warn", {
        scope: "rag-rewrite",
        event: "rewrite-fallback",
        reason,
        question,
        conversationHistoryCount: input.conversationHistory?.length ?? 0,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
              }
            : String(error),
      });

      return {
        question,
        retrievalQuestion: question,
        rewritten: false,
        reason,
      };
    }
  },

  async runNode(
    input: MaybeRewriteInput,
  ): Promise<RagNodeResult<RewriteStatePatch>> {
    const startedAtMs = Date.now();
    const messages = buildRewriteMessages(
      input.question,
      input.conversationHistory,
    );
    const invocation = providerProxyService.describeTaskChatInvocation(messages);
    const result = await this.maybeRewrite(input);
    return {
      state: {
        retrievalQuestion: result.retrievalQuestion,
        queryRewritten: result.rewritten,
        queryRewriteReason: result.reason,
      },
      observation: createObservation({
        label: "准备检索问题",
        summary: result.rewritten
          ? "已根据最近对话补足检索查询"
          : "当前问题足够清晰，直接进入检索",
        details: {
          rewritten: result.rewritten,
          reason: result.reason,
          retrievalQuestion: result.retrievalQuestion,
        },
        environment: withTiming(
          startedAtMs,
          {
            ...createModelEnvironment({
              role: "task",
              providerCode: invocation.providerCode,
              providerLabel: invocation.providerLabel,
              protocol: invocation.protocol,
              operation: invocation.operation,
              endpoint: invocation.endpoint,
              model: invocation.model,
              modelConfigId: invocation.modelConfigId,
              params: invocation.params,
              request: invocation.request,
            }),
            ...createResultEnvironment({
              success: true,
              finishReason: result.rewritten ? "rewritten" : "unchanged",
              metrics: {
                inputCount: messages.length,
                outputCount: 1,
              },
              response: {
                model: invocation.model,
                summary: {
                  rewritten: result.rewritten,
                  retrievalQuestionLength: Array.from(result.retrievalQuestion).length,
                },
              },
            }),
            context: {
              historyMessageCount: input.conversationHistory?.length ?? 0,
              originalQuestionLength: Array.from(input.question.trim()).length,
            },
          },
        ),
      }),
    };
  },
};
