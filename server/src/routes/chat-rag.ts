import type { FastifyPluginAsync } from "fastify";
import { ragPipeline, type RAGPipelineInput } from "@/services/rag-pipeline";
import { error, success } from "@/utils/index.js";
import { requireAuth } from "@/db/auth.db.js";

const chatRagRoute: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireAuth);

  // RAG 增强聊天（非流式）
  app.post<{
    Body: RAGPipelineInput;
  }>(
    "/chat/rag",
    {
      schema: {
        tags: ["Chat"],
        summary: "RAG 增强聊天",
        operationId: "chatWithRAG",
        body: {
          type: "object",
          required: ["question"],
          properties: {
            question: { type: "string", minLength: 1 },
            knowledgeBaseId: { type: "string" },
            topK: { type: "number", minimum: 1, maximum: 50 },
            topN: { type: "number", minimum: 1, maximum: 20 },
            systemPrompt: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  answer: { type: "string" },
                  sources: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        chunkId: { type: "number" },
                        documentId: { type: "string" },
                        documentName: { type: "string" },
                        content: { type: "string" },
                        score: { type: "number" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const result = await ragPipeline.run(request.body);
        return reply.send(success(result));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return reply.send(error(message));
      }
    }
  );

  // RAG 增强聊天（流式）
  app.post<{
    Body: RAGPipelineInput;
  }>(
    "/chat/rag/stream",
    {
      schema: {
        tags: ["Chat"],
        summary: "RAG 增强流式聊天",
        operationId: "chatWithRAGStream",
        body: {
          type: "object",
          required: ["question"],
          properties: {
            question: { type: "string", minLength: 1 },
            knowledgeBaseId: { type: "string" },
            topK: { type: "number", minimum: 1, maximum: 50 },
            topN: { type: "number", minimum: 1, maximum: 20 },
            systemPrompt: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const stream = ragPipeline.stream(request.body);

        reply.header("Content-Type", "text/event-stream");
        reply.header("Cache-Control", "no-cache");
        reply.header("Connection", "keep-alive");

        return reply.send(stream);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return reply.send(error(message));
      }
    }
  );

  // 仅检索（不生成）
  app.post<{
    Body: RAGPipelineInput;
  }>(
    "/chat/rag/retrieve",
    {
      schema: {
        tags: ["Chat"],
        summary: "RAG 检索（仅返回相关文档）",
        operationId: "ragRetrieveOnly",
        body: {
          type: "object",
          required: ["question"],
          properties: {
            question: { type: "string", minLength: 1 },
            knowledgeBaseId: { type: "string" },
            topK: { type: "number", minimum: 1, maximum: 50 },
            topN: { type: "number", minimum: 1, maximum: 20 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    chunkId: { type: "number" },
                    documentId: { type: "string" },
                    documentName: { type: "string" },
                    content: { type: "string" },
                    score: { type: "number" },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const chunks = await ragPipeline.retrieveOnly(request.body);
        return reply.send(success(chunks));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return reply.send(error(message));
      }
    }
  );
};

export default chatRagRoute;