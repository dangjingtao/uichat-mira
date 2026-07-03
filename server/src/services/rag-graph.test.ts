import { afterEach, describe, expect, it, vi } from "vitest";
import {
  embedService,
  generateService,
  rerankService,
  retrieveService,
  rewriteService,
} from "./rag-nodes";
import { ragGraph } from "./rag-graph";

describe("ragGraph request context boundaries", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps role request context out of rewrite/retrieve/rerank and passes it only to generate", async () => {
    const roleContext = [
      {
        role: "system" as const,
        content: "角色名：Programmer\n\n约束：不要假装运行过代码。",
      },
    ];

    const rewriteSpy = vi.spyOn(rewriteService, "runNode").mockResolvedValue({
      state: {
        retrievalQuestion: "rewritten query",
        queryRewritten: true,
        queryRewriteReason: "short-follow-up",
      },
      observation: {
        label: "rewrite",
      },
    });
    const embedSpy = vi.spyOn(embedService, "runNode").mockResolvedValue({
      state: {
        embedding: [0.1, 0.2],
        embeddingDimensions: 2,
        embeddingModel: "embedding-test",
        embeddingModelConfigId: "embedding-config",
      },
      observation: {
        label: "embed",
      },
    });
    const retrieveSpy = vi.spyOn(retrieveService, "runNode").mockResolvedValue({
      state: {
        retrievedChunks: [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            documentName: "Doc 1",
            content: "Reference content",
            score: 0.9,
          },
        ],
      },
      observation: {
        label: "retrieve",
        sources: [],
      },
    });
    const rerankSpy = vi.spyOn(rerankService, "runNode").mockResolvedValue({
      state: {
        rerankedChunks: [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            documentName: "Doc 1",
            content: "Reference content",
            score: 0.9,
          },
        ],
        sources: [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            documentName: "Doc 1",
            content: "Reference content",
            score: 0.9,
          },
        ],
      },
      observation: {
        label: "rerank",
        sources: [],
      },
    });
    const generateSpy = vi
      .spyOn(generateService, "streamGenerateText")
      .mockImplementation(async function* () {
        yield "answer";
      });
    vi.spyOn(generateService, "toNodeResult").mockReturnValue({
      state: {
        answer: "answer",
        sources: [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            documentName: "Doc 1",
            content: "Reference content",
            score: 0.9,
          },
        ],
      },
      observation: {
        label: "generate",
        sources: [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            documentName: "Doc 1",
            content: "Reference content",
            score: 0.9,
          },
        ],
      },
    });

    const result = await ragGraph.run({
      question: "这个怎么处理？",
      requestContextMessages: roleContext,
      conversationHistory: [{ role: "assistant", content: "previous answer" }],
    });

    expect(result.answer).toBe("answer");
    expect(rewriteSpy).toHaveBeenCalledWith({
      question: "这个怎么处理？",
      conversationHistory: [{ role: "assistant", content: "previous answer" }],
    });
    expect(rewriteSpy.mock.calls[0]?.[0]).not.toHaveProperty(
      "requestContextMessages",
    );
    expect(retrieveSpy.mock.calls[0]?.[0]).not.toHaveProperty(
      "requestContextMessages",
    );
    expect(rerankSpy.mock.calls[0]?.[0]).not.toHaveProperty(
      "requestContextMessages",
    );
    expect(generateSpy.mock.calls[0]?.[0]).toMatchObject({
      query: "这个怎么处理？",
      requestContextMessages: roleContext,
      conversationHistory: [{ role: "assistant", content: "previous answer" }],
    });
    expect(embedSpy).toHaveBeenCalledWith("rewritten query");
  });

  it("keeps role request context out of retrieve and rerank node inputs", async () => {
    const roleContext = [
      {
        role: "system" as const,
        content: "角色名：Programmer",
      },
    ];

    vi.spyOn(rewriteService, "runNode").mockResolvedValue({
      state: {
        retrievalQuestion: "same query",
        queryRewritten: false,
        queryRewriteReason: "preserve-original",
      },
      observation: {
        label: "rewrite",
      },
    });
    vi.spyOn(embedService, "runNode").mockResolvedValue({
      state: {
        embedding: [0.1, 0.2],
        embeddingDimensions: 2,
        embeddingModel: "embedding-test",
        embeddingModelConfigId: "embedding-config",
      },
      observation: {
        label: "embed",
      },
    });
    const retrieveSpy = vi.spyOn(retrieveService, "runNode").mockResolvedValue({
      state: {
        retrievedChunks: [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            documentName: "Doc 1",
            content: "Reference content",
            score: 0.9,
          },
        ],
      },
      observation: {
        label: "retrieve",
        sources: [],
      },
    });
    const rerankSpy = vi.spyOn(rerankService, "runNode").mockResolvedValue({
      state: {
        rerankedChunks: [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            documentName: "Doc 1",
            content: "Reference content",
            score: 0.9,
          },
        ],
        sources: [
          {
            chunkId: "chunk-1",
            documentId: "doc-1",
            documentName: "Doc 1",
            content: "Reference content",
            score: 0.9,
          },
        ],
      },
      observation: {
        label: "rerank",
        sources: [],
      },
    });
    vi.spyOn(generateService, "streamGenerateText").mockImplementation(
      async function* () {
        yield "answer";
      },
    );
    vi.spyOn(generateService, "toNodeResult").mockReturnValue({
      state: {
        answer: "answer",
        sources: [],
      },
      observation: {
        label: "generate",
        sources: [],
      },
    });

    await ragGraph.run({
      question: "query",
      requestContextMessages: roleContext,
    });

    expect(retrieveSpy).toHaveBeenCalledOnce();
    expect(retrieveSpy.mock.calls[0]?.[0]).toEqual({
      question: "same query",
      embedding: [0.1, 0.2],
      embeddingDimensions: 2,
      embeddingModel: "embedding-test",
      embeddingModelConfigId: "embedding-config",
      knowledgeBaseId: undefined,
      topK: 10,
    });
    expect(rerankSpy).toHaveBeenCalledOnce();
    expect(rerankSpy.mock.calls[0]?.[0]).toEqual({
      query: "query",
      chunks: [
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          documentName: "Doc 1",
          content: "Reference content",
          score: 0.9,
        },
      ],
      topN: undefined,
    });
  });

  it("never turns role request context into retrieved chunks or final sources", async () => {
    const roleContext = [
      {
        role: "system" as const,
        content: "角色名：Programmer\n约束：不要假装运行过代码。",
      },
    ];
    const retrievedChunk = {
      chunkId: "chunk-1",
      documentId: "doc-1",
      documentName: "Doc 1",
      content: "Knowledge base reference content",
      score: 0.9,
    };

    vi.spyOn(rewriteService, "runNode").mockResolvedValue({
      state: {
        retrievalQuestion: "query",
        queryRewritten: false,
        queryRewriteReason: "preserve-original",
      },
      observation: {
        label: "rewrite",
      },
    });
    vi.spyOn(embedService, "runNode").mockResolvedValue({
      state: {
        embedding: [0.1, 0.2],
        embeddingDimensions: 2,
        embeddingModel: "embedding-test",
        embeddingModelConfigId: "embedding-config",
      },
      observation: {
        label: "embed",
      },
    });
    vi.spyOn(retrieveService, "runNode").mockResolvedValue({
      state: {
        retrievedChunks: [retrievedChunk],
      },
      observation: {
        label: "retrieve",
        sources: [],
      },
    });
    vi.spyOn(rerankService, "runNode").mockResolvedValue({
      state: {
        rerankedChunks: [retrievedChunk],
        sources: [retrievedChunk],
      },
      observation: {
        label: "rerank",
        sources: [retrievedChunk],
      },
    });
    vi.spyOn(generateService, "streamGenerateText").mockImplementation(
      async function* () {
        yield "answer";
      },
    );
    vi.spyOn(generateService, "toNodeResult").mockReturnValue({
      state: {
        answer: "answer",
        sources: [retrievedChunk],
      },
      observation: {
        label: "generate",
        sources: [retrievedChunk],
      },
    });

    const result = await ragGraph.run({
      question: "query",
      requestContextMessages: roleContext,
    });

    expect(result.retrievedChunks).toEqual([retrievedChunk]);
    expect(result.rerankedChunks).toEqual([retrievedChunk]);
    expect(result.sources).toEqual([retrievedChunk]);
    expect(result.sources.some((chunk) => /程序员|假装运行过代码/.test(chunk.content))).toBe(
      false,
    );
    expect(result.retrievedChunks.some((chunk) => chunk.documentId === "role")).toBe(
      false,
    );
  });

  it("uses role-aware generate fallback when retrieval returns no context", async () => {
    const roleContext = [
      {
        role: "system" as const,
        content: "角色名：备孕砖家\n约束：礼貌、克制、专业。",
      },
    ];

    vi.spyOn(rewriteService, "runNode").mockResolvedValue({
      state: {
        retrievalQuestion: "你好",
        queryRewritten: false,
        queryRewriteReason: "preserve-original",
      },
      observation: {
        label: "rewrite",
      },
    });
    vi.spyOn(embedService, "runNode").mockResolvedValue({
      state: {
        embedding: [0.1, 0.2],
        embeddingDimensions: 2,
        embeddingModel: "embedding-test",
        embeddingModelConfigId: "embedding-config",
      },
      observation: {
        label: "embed",
      },
    });
    vi.spyOn(retrieveService, "runNode").mockResolvedValue({
      state: {
        retrievedChunks: [],
      },
      observation: {
        label: "retrieve",
        sources: [],
      },
    });
    const generateSpy = vi
      .spyOn(generateService, "streamGenerateText")
      .mockImplementation(async function* () {
        yield "您好，目前知识库里没有和这个问题直接相关的信息。";
      });
    vi.spyOn(generateService, "toNodeResult").mockReturnValue({
      state: {
        answer: "您好，目前知识库里没有和这个问题直接相关的信息。",
        sources: [],
      },
      observation: {
        label: "generate",
        sources: [],
      },
    });

    const result = await ragGraph.run({
      question: "你好",
      requestContextMessages: roleContext,
    });

    expect(result.answer).toContain("您好");
    expect(generateSpy).toHaveBeenCalledWith({
      query: "你好",
      chunks: [],
      systemPrompt: undefined,
      requestContextMessages: roleContext,
      conversationHistory: undefined,
    });
  });
});
