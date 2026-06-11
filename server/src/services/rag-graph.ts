import {
  Annotation,
  END,
  START,
  StateGraph,
  getWriter,
  type LangGraphRunnableConfig,
} from "@langchain/langgraph";
import {
  embedService,
  generateService,
  rerankService,
  retrieveService,
  type RetrievedChunk,
} from "./rag-nodes";
import type { NormalizedChatMessage } from "./provider-proxy.service";

const RAGGraphState = Annotation.Root({
  question: Annotation<string>,
  knowledgeBaseId: Annotation<string | undefined>,
  topK: Annotation<number | undefined>,
  topN: Annotation<number | undefined>,
  systemPrompt: Annotation<string | undefined>,
  conversationHistory: Annotation<NormalizedChatMessage[] | undefined>,
  embedding: Annotation<number[] | undefined>,
  retrievedChunks: Annotation<RetrievedChunk[] | undefined>,
  rerankedChunks: Annotation<RetrievedChunk[] | undefined>,
  answer: Annotation<string | undefined>,
  sources: Annotation<RetrievedChunk[] | undefined>,
});

export type RAGGraphStateType = typeof RAGGraphState.State;

export interface RAGGraphInput {
  question: string;
  knowledgeBaseId?: string;
  topK?: number;
  topN?: number;
  systemPrompt?: string;
  conversationHistory?: NormalizedChatMessage[];
}

export interface RAGGraphOutput {
  answer: string;
  sources: RetrievedChunk[];
  retrievedChunks: RetrievedChunk[];
  rerankedChunks: RetrievedChunk[];
}

export type RAGGraphStreamUpdate =
  | { embed?: { embedding: number[] | undefined } }
  | { retrieve?: { retrievedChunks: RetrievedChunk[] | undefined } }
  | {
      rerank?: {
        rerankedChunks: RetrievedChunk[] | undefined;
        sources: RetrievedChunk[] | undefined;
      };
    }
  | {
      generate?: {
        answer: string | undefined;
        sources: RetrievedChunk[] | undefined;
      };
    };

export interface RAGGraphCustomStreamChunk {
  type: "generate-delta";
  delta: string;
}

const embedNode = async (state: RAGGraphStateType) => {
  const embedding = await embedService.embedSingle(state.question);
  return { embedding };
};

const retrieveNode = async (state: RAGGraphStateType) => {
  const result = await retrieveService.retrieve({
    embedding: state.embedding ?? [],
    knowledgeBaseId: state.knowledgeBaseId,
    topK: state.topK ?? 10,
  });

  return {
    retrievedChunks: result.chunks,
  };
};

const routeAfterRetrieve = (state: RAGGraphStateType) => {
  if ((state.retrievedChunks?.length ?? 0) > 0) {
    return "rerank";
  }

  return "generate";
};

const rerankNode = async (state: RAGGraphStateType) => {
  const result = await rerankService.rerank({
    query: state.question,
    chunks: state.retrievedChunks ?? [],
    topN: state.topN ?? 4,
  });

  return {
    rerankedChunks: result.chunks,
    sources: result.chunks,
  };
};

const generateNode = async (
  state: RAGGraphStateType,
  config?: LangGraphRunnableConfig,
) => {
  const chunks = state.rerankedChunks ?? state.retrievedChunks ?? [];
  const writer = getWriter(config);
  let answer = "";

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
    writer?.({
      type: "generate-delta",
      delta,
    } satisfies RAGGraphCustomStreamChunk);
  }

  return {
    answer,
    sources: chunks,
  };
};

const ragStateGraph = new StateGraph(RAGGraphState)
  .addNode("embed", embedNode)
  .addNode("retrieve", retrieveNode)
  .addNode("rerank", rerankNode)
  .addNode("generate", generateNode)
  .addEdge(START, "embed")
  .addEdge("embed", "retrieve")
  .addConditionalEdges("retrieve", routeAfterRetrieve, ["rerank", "generate"])
  .addEdge("rerank", "generate")
  .addEdge("generate", END)
  .compile();

export const ragGraph = {
  async run(input: RAGGraphInput): Promise<RAGGraphOutput> {
    const state = await ragStateGraph.invoke(input);
    return {
      answer: state.answer ?? "",
      sources: state.sources ?? [],
      retrievedChunks: state.retrievedChunks ?? [],
      rerankedChunks: state.rerankedChunks ?? state.retrievedChunks ?? [],
    };
  },

  async retrieve(input: RAGGraphInput): Promise<RetrievedChunk[]> {
    const state = await ragStateGraph.invoke(input);
    return state.rerankedChunks ?? state.retrievedChunks ?? [];
  },

  async streamUpdates(input: RAGGraphInput) {
    return ragStateGraph.stream(input, {
      streamMode: "updates",
    });
  },

  async streamValues(input: RAGGraphInput) {
    return ragStateGraph.stream(input, {
      streamMode: "values",
    });
  },

  async streamEvents(input: RAGGraphInput) {
    return ragStateGraph.stream(input, {
      streamMode: ["updates", "custom"],
    });
  },

  get graph() {
    return ragStateGraph;
  },
};
