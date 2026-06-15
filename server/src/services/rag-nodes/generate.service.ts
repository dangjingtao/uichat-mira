import { Readable } from "node:stream";
import {
  providerProxyService,
  type NormalizedChatMessage,
} from "@/services/provider-proxy.service";
import type { RetrievedChunk } from "./retrieve.service";
import type { RagNodeResult } from "@/services/rag-node-contract";
import {
  createModelCallObservation,
} from "@/services/rag-node-observation";
import { createAssistantTextStream } from "@/services/assistant-stream-events";

export interface GenerateInput {
  query: string;
  chunks: RetrievedChunk[];
  systemPrompt?: string;
  conversationHistory?: NormalizedChatMessage[];
}

export interface GenerateOutput {
  answer: string;
  sources: RetrievedChunk[];
}

export interface GenerateStatePatch {
  answer: string;
  sources: RetrievedChunk[];
}

const DEFAULT_SYSTEM_PROMPT = `你是一个专业的知识库问答助手。
请根据提供的参考文档内容回答用户问题。

规则：
1. 优先使用参考文档中的信息进行回答
2. 如果文档中没有相关信息，明确说明"根据现有知识库，我无法回答这个问题"
3. 回答要简洁明了，不要添加无关内容
4. 可以引用文档中的具体内容，但不要直接复制粘贴大段文本

参考文档：
{context}`;

/**
 * 格式化上下文文档
 */
const formatContext = (chunks: RetrievedChunk[]): string => {
  return chunks
    .map((chunk, index) => {
      const sourceLabel = chunk.documentName || `文档${index + 1}`;
      return `[${index + 1}] ${sourceLabel}\n${chunk.content}`;
    })
    .join("\n\n");
};

const buildMessages = (input: GenerateInput): NormalizedChatMessage[] => {
  const context = formatContext(input.chunks);
  const systemPrompt = (input.systemPrompt ?? DEFAULT_SYSTEM_PROMPT).replace(
    "{context}",
    context
  );

  return [
    { role: "system", content: systemPrompt },
    ...(input.conversationHistory ?? []),
    { role: "user", content: input.query },
  ];
};

/**
 * 构建 SSE 响应流
 */
const createSseStream = (streamText: () => AsyncIterable<string>) =>
  createAssistantTextStream(streamText, {
    includeStartStep: true,
    getErrorMessage: (error) => String(error),
  });

/**
 * 生成服务节点
 * 复用 provider-proxy.service 的 streamChat 方法
 */
export const generateService = {
  streamGenerateText(input: GenerateInput): AsyncIterable<string> {
    return providerProxyService.streamChatText("default", buildMessages(input));
  },

  /**
   * 生成回答（非流式）
   * @param input 查询文本、检索结果、系统提示词
   * @returns 生成的回答
   */
  async generate(input: GenerateInput): Promise<GenerateOutput> {
    // 复用现有服务
    const stream = this.streamGenerateText(input);

    // 收集完整回答
    let answer = "";
    for await (const chunk of stream) {
      answer += chunk;
    }

    return {
      answer,
      sources: input.chunks,
    };
  },

  async runNode(input: GenerateInput): Promise<RagNodeResult<GenerateStatePatch>> {
    const result = await this.generate(input);
    return this.toNodeResult(result);
  },

  toNodeResult(
    result: GenerateOutput,
    meta?: {
      startedAtMs?: number;
      input?: GenerateInput;
    },
  ): RagNodeResult<GenerateStatePatch> {
    const messages = buildMessages(meta?.input ?? {
      query: "",
      chunks: [],
    });
    const invocation = providerProxyService.describeChatInvocation(
      "default",
      messages,
    );

    return {
      state: {
        answer: result.answer,
        sources: result.sources,
      },
      observation: createModelCallObservation({
        startedAtMs: meta?.startedAtMs ?? Date.now(),
        label: "组织回答",
        summary: result.answer.trim() ? "回答生成完成" : "已完成回答生成",
        details: {
          sourceCount: result.sources.length,
        },
        sources: result.sources,
        role: "llm",
        providerCode: invocation.providerCode,
        providerLabel: invocation.providerLabel,
        protocol: invocation.protocol,
        operation: invocation.operation,
        endpoint: invocation.endpoint,
        model: invocation.model,
        modelConfigId: invocation.modelConfigId,
        params: invocation.params,
        request: invocation.request,
        result: {
          success: true,
          finishReason: "stop",
          metrics: {
            inputCount: messages.length,
            outputCount: Array.from(result.answer).length,
            returnedCount: result.sources.length,
          },
          response: {
            model: invocation.model,
            summary: {
              answerLength: Array.from(result.answer).length,
              sourceCount: result.sources.length,
            },
          },
        },
        retrieval: {
          candidateCount: meta?.input?.chunks.length ?? result.sources.length,
          returnedCount: result.sources.length,
        },
        context: {
          conversationHistoryCount: meta?.input?.conversationHistory?.length ?? null,
          systemPromptProvided: Boolean(meta?.input?.systemPrompt),
        },
      }),
    };
  },

  /**
   * 生成回答（流式）
   * @param input 查询文本、检索结果、系统提示词
   * @returns SSE 流
   */
  streamGenerate(input: GenerateInput): Readable {
    // 将纯文本 token 流包装为 UI 需要的 SSE 事件流
    return createSseStream(() => this.streamGenerateText(input));
  },

  /**
   * 简单对话（不使用 RAG）
   * @param query 用户问题
   * @param conversationHistory 对话历史
   * @returns 生成的回答
   */
  async simpleChat(
    query: string,
    conversationHistory?: NormalizedChatMessage[]
  ): Promise<string> {
    const messages: NormalizedChatMessage[] = [
      ...(conversationHistory ?? []),
      { role: "user", content: query },
    ];

    const stream = providerProxyService.streamChatText("default", messages);

    let answer = "";
    for await (const chunk of stream) {
      answer += chunk;
    }

    return answer;
  },
};
