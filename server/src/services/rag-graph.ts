import {
  Annotation,
  END,
  START,
  StateGraph,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";
import {
  rewriteService,
  embedService,
  generateService,
  rerankService,
  retrieveService,
  type RetrievedChunk,
} from "./rag-nodes";
import type { NormalizedChatMessage } from "./provider-proxy.service";
import { writeStructuredLog } from "@/logger";
import {
  emitGenerateDelta,
  emitRagNodeEvent,
  emitRagSourcesEvent,
  type RagCustomStreamChunk,
} from "./rag-events";
import type { RagNodeResult } from "./rag-node-contract";
import { NO_CONTEXT_ANSWER } from "./rag-response-constants";

// RAG 图的共享状态定义。
// 每个节点只读取自己需要的字段，并把新增结果写回同一个状态对象，供后续节点继续使用。
const RAGGraphState = Annotation.Root({
  // 用户当前问题，是整个 RAG 流程的核心输入。
  question: Annotation<string>,
  // 检索阶段实际使用的问题，可由 rewrite 节点在必要时改写。
  retrievalQuestion: Annotation<string | undefined>,
  // 当前查询是否发生过改写。
  queryRewritten: Annotation<boolean | undefined>,
  // 触发改写的原因，便于调试和前端展示。
  queryRewriteReason: Annotation<string | undefined>,
  // 可选知识库 ID；不传时由检索服务自行决定检索范围。
  knowledgeBaseId: Annotation<string | undefined>,
  // 向量检索阶段召回的候选数量。
  topK: Annotation<number | undefined>,
  // 重排阶段保留的最终上下文数量。
  topN: Annotation<number | undefined>,
  // 可选系统提示词，会在生成阶段传给模型。
  systemPrompt: Annotation<string | undefined>,
  // 可选历史对话，用于让生成模型保留上下文语义。
  conversationHistory: Annotation<NormalizedChatMessage[] | undefined>,
  // 问题文本经过 embedding 节点生成的向量。
  embedding: Annotation<number[] | undefined>,
  // embedding 向量维度，用于校验检索索引是否匹配。
  embeddingDimensions: Annotation<number | undefined>,
  // 实际使用的 embedding 模型名称。
  embeddingModel: Annotation<string | undefined>,
  // 实际使用的 embedding 模型配置 ID。
  embeddingModelConfigId: Annotation<string | undefined>,
  // 检索阶段召回的原始片段。
  retrievedChunks: Annotation<RetrievedChunk[] | undefined>,
  // 重排后的片段；有重排结果时优先作为生成上下文。
  rerankedChunks: Annotation<RetrievedChunk[] | undefined>,
  // 生成节点产出的最终回答。
  answer: Annotation<string | undefined>,
  // 对外返回的引用来源，通常与最终进入生成阶段的片段一致。
  sources: Annotation<RetrievedChunk[] | undefined>,
});

export type RAGGraphStateType = typeof RAGGraphState.State;

// RAG 图的外部输入。调用方只需要提供问题，其他字段都是调优或上下文参数。
export interface RAGGraphInput {
  question: string;
  knowledgeBaseId?: string;
  topK?: number;
  topN?: number;
  systemPrompt?: string;
  conversationHistory?: NormalizedChatMessage[];
}

// RAG 图的完整输出，包含最终回答以及中间检索/重排结果，方便前端展示和调试。
export interface RAGGraphOutput {
  answer: string;
  sources: RetrievedChunk[];
  retrievedChunks: RetrievedChunk[];
  rerankedChunks: RetrievedChunk[];
}

// LangGraph updates 流的节点增量类型。
// 每个联合分支对应一个节点的状态更新，前端可以据此展示流程进度。
export type RAGGraphStreamUpdate =
  | {
      rewrite?: {
        retrievalQuestion: string | undefined;
        rewritten: boolean | undefined;
        reason: string | undefined;
      };
    }
  | {
      // embedding 节点完成后输出问题向量及其模型元信息。
      embed?: {
        embedding: number[] | undefined;
        dimensions: number | undefined;
        model: string | undefined;
        modelConfigId: string | undefined;
      };
    }
  | { retrieve?: { retrievedChunks: RetrievedChunk[] | undefined } }
  | {
      // rerank 节点完成后输出重排结果，同时把这些结果作为引用来源。
      rerank?: {
        rerankedChunks: RetrievedChunk[] | undefined;
        sources: RetrievedChunk[] | undefined;
      };
    }
  | {
      // generate 节点完成后输出完整回答和最终引用来源。
      generate?: {
        answer: string | undefined;
        sources: RetrievedChunk[] | undefined;
      };
    };

// 自定义流事件类型。
// generate 节点会把大模型增量 token 通过 custom stream 发送出去，用于前端打字机式展示。
export type RAGGraphCustomStreamChunk = RagCustomStreamChunk;

const createObservableNode = <TStatePatch>(
  nodeId: string,
  handler: (
    state: RAGGraphStateType,
    config?: LangGraphRunnableConfig,
  ) => Promise<RagNodeResult<TStatePatch>>,
) => {
  return async (state: RAGGraphStateType, config?: LangGraphRunnableConfig) => {
    const fallbackLabel = nodeId;
    emitRagNodeEvent(config, {
      nodeId,
      nodeType: nodeId,
      phase: "start",
      label: fallbackLabel,
    });

    try {
      const result = await handler(state, config);
      emitRagNodeEvent(config, {
        nodeId,
        nodeType: nodeId,
        phase: "done",
        label: result.observation.label,
        ...(result.observation.summary
          ? { summary: result.observation.summary }
          : {}),
        ...(result.observation.details
          ? { details: result.observation.details }
          : {}),
        ...(result.observation.environment
          ? { environment: result.observation.environment }
          : {}),
      });

      if (result.observation.sources && result.observation.sources.length > 0) {
        emitRagSourcesEvent(config, result.observation.sources);
      }

      return result.state;
    } catch (error) {
      emitRagNodeEvent(config, {
        nodeId,
        nodeType: nodeId,
        phase: "error",
        label: fallbackLabel,
        summary: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
};

const rewriteNode = createObservableNode("rewrite", async (state) => {
    return rewriteService.runNode({
      question: state.question,
      conversationHistory: state.conversationHistory,
    });
  });

// embedding 节点：把用户问题转成向量，并记录模型元信息。
// 后续检索节点会使用这些字段去匹配同维度、同模型配置的知识库向量。
const embedNode = createObservableNode("embed", async (state) => {
    return embedService.runNode(
      state.retrievalQuestion ?? state.question,
    );
  });

// retrieve 节点：根据问题向量从知识库召回 topK 个候选片段。
// 如果调用方没有传 topK，则默认召回 10 条候选片段。
const retrieveNode = createObservableNode("retrieve", async (state) => {
    const result = await retrieveService.runNode({
      embedding: state.embedding ?? [],
      embeddingDimensions: state.embeddingDimensions,
      embeddingModel: state.embeddingModel,
      embeddingModelConfigId: state.embeddingModelConfigId,
      knowledgeBaseId: state.knowledgeBaseId,
      topK: state.topK ?? 10,
    });

    writeStructuredLog("info", {
      scope: "rag-graph",
      event: "retrieve-complete",
      question: state.question,
      knowledgeBaseId: state.knowledgeBaseId ?? null,
      retrievedCount: result.state.retrievedChunks.length,
      topK: state.topK ?? 10,
      topN: state.topN ?? null,
    });

    return result;
  });

// retrieve 之后的路由判断：
// - 有召回片段时进入 rerank，进一步筛选上下文；
// - 没有召回片段时直接 generate，让模型在无知识库上下文的情况下回答。
const routeAfterRetrieve = (state: RAGGraphStateType) => {
  if ((state.retrievedChunks?.length ?? 0) > 0) {
    return "rerank";
  }

  return "fallbackAnswer";
};

// rerank 节点：对检索候选片段按与问题的相关性重新排序，并按 topN 截断。
// 重排结果同时写入 rerankedChunks 和 sources，后续生成与最终返回都优先使用它们。
const rerankNode = createObservableNode("rerank", async (state) => {
    writeStructuredLog("info", {
      scope: "rag-graph",
      event: "rerank-enter",
      question: state.question,
      retrievedCount: state.retrievedChunks?.length ?? 0,
      topN: state.topN ?? null,
    });

    const result = await rerankService.runNode({
      query: state.question,
      chunks: state.retrievedChunks ?? [],
      topN: state.topN,
    });

    writeStructuredLog("info", {
      scope: "rag-graph",
      event: "rerank-exit",
      question: state.question,
      rerankedCount: result.state.rerankedChunks.length,
    });

    return result;
  });

const routeAfterRerank = (state: RAGGraphStateType) => {
  if ((state.rerankedChunks?.length ?? 0) > 0) {
    return "generate";
  }

  return "fallbackAnswer";
};

const fallbackAnswerNode = createObservableNode("fallbackAnswer", async (_state, config) => {
    emitGenerateDelta(config, NO_CONTEXT_ANSWER);

    return {
      state: {
        answer: NO_CONTEXT_ANSWER,
        sources: [],
      },
      observation: {
        label: "返回拒答结果",
        summary: "没有可用候选片段，直接返回固定拒答",
        details: {
          reason: "no-context-after-retrieval",
          answer: NO_CONTEXT_ANSWER,
        },
        environment: {
          result: {
            success: true,
            finishReason: "no-context-fallback",
            metrics: {
              returnedCount: 0,
              candidateCount: 0,
            },
            response: {
              summary: {
                answerLength: Array.from(NO_CONTEXT_ANSWER).length,
                sourceCount: 0,
              },
            },
          },
          timing: {
            startedAt: new Date().toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs: 0,
          },
        },
      },
    };
  });

// generate 节点：使用最终上下文片段调用生成模型，并把回答增量实时写入 custom stream。
// 上下文优先级为 rerankedChunks > retrievedChunks > 空数组。
const generateNode = createObservableNode("generate", async (state, config) => {
    const chunks = state.rerankedChunks ?? state.retrievedChunks ?? [];
    let answer = "";
    const startedAtMs = Date.now();

    for await (const delta of generateService.streamGenerateText({
      query: state.question,
      chunks,
      systemPrompt: state.systemPrompt,
      conversationHistory: state.conversationHistory,
    })) {
      if (!delta) {
        continue;
      }

      answer += delta;
      emitGenerateDelta(config, delta);
    }

    return generateService.toNodeResult({
      answer,
      sources: chunks,
    }, {
      startedAtMs,
      input: {
        query: state.question,
        chunks,
        systemPrompt: state.systemPrompt,
        conversationHistory: state.conversationHistory,
      },
    });
  });

// LangGraph 编排定义：
// START -> embed -> retrieve -> (rerank | generate) -> generate -> END。
// retrieve 后是否进入 rerank 由 routeAfterRetrieve 根据召回结果动态决定。
const ragStateGraph = new StateGraph(RAGGraphState)
  .addNode("rewrite", rewriteNode)
  .addNode("embed", embedNode)
  .addNode("retrieve", retrieveNode)
  .addNode("rerank", rerankNode)
  .addNode("fallbackAnswer", fallbackAnswerNode)
  .addNode("generate", generateNode)
  .addEdge(START, "rewrite")
  .addEdge("rewrite", "embed")
  .addEdge("embed", "retrieve")
  .addConditionalEdges("retrieve", routeAfterRetrieve, ["rerank", "fallbackAnswer"])
  .addConditionalEdges("rerank", routeAfterRerank, ["generate", "fallbackAnswer"])
  .addEdge("fallbackAnswer", END)
  .addEdge("generate", END)
  .compile();

// 对外暴露的 RAG 图服务封装。
// 这里隐藏 LangGraph 的细节，让 route/service 层可以用普通方法调用完整流程或不同流模式。
export const ragGraph = {
  // 执行完整 RAG 流程并返回最终回答、引用来源以及中间结果。
  async run(input: RAGGraphInput): Promise<RAGGraphOutput> {
    const state = await ragStateGraph.invoke(input);
    return {
      answer: state.answer ?? "",
      sources: state.sources ?? [],
      retrievedChunks: state.retrievedChunks ?? [],
      rerankedChunks: state.rerankedChunks ?? state.retrievedChunks ?? [],
    };
  },

  // 只关心最终可用上下文片段时使用；仍会执行完整图，因此会经过生成节点。
  async retrieve(input: RAGGraphInput): Promise<RetrievedChunk[]> {
    const state = await ragStateGraph.invoke(input);
    return state.rerankedChunks ?? state.retrievedChunks ?? [];
  },

  // 以 updates 模式流式返回每个节点产生的局部状态更新。
  async streamUpdates(input: RAGGraphInput) {
    return ragStateGraph.stream(input, {
      streamMode: "updates",
    });
  },

  // 以 values 模式流式返回图状态的连续快照。
  async streamValues(input: RAGGraphInput) {
    return ragStateGraph.stream(input, {
      streamMode: "values",
    });
  },

  // 同时开启 updates 和 custom：既能看到节点状态更新，也能接收生成阶段的文本 delta。
  async streamEvents(input: RAGGraphInput) {
    return ragStateGraph.stream(input, {
      streamMode: ["updates", "custom"],
    });
  },

  // 暴露底层图对象，供需要直接操作 LangGraph 的场景使用。
  get graph() {
    return ragStateGraph;
  },
};
