import {
  providerProxyService,
  type EmbeddingResult,
} from "@/services/provider-proxy.service";
import type { RagNodeResult } from "@/services/rag-node-contract";
import {
  createModelCallObservation,
} from "@/services/rag-node-observation";

export interface EmbedInput {
  text: string | string[];
}

export interface EmbedOutput {
  embeddings: number[][];
  dimensions: number;
  model: string;
  modelConfigId: string;
  providerCode: string;
}

export interface EmbedStatePatch {
  embedding: number[];
  embeddingDimensions: number;
  embeddingModel: string;
  embeddingModelConfigId: string;
}

/**
 * 向量化服务节点
 * 复用 provider-proxy.service 的 createEmbeddings 方法
 */
export const embedService = {
  /**
   * 将文本转换为向量
   * @param input 单个文本或文本数组
   * @returns 向量结果
   */
  async embed(input: EmbedInput): Promise<EmbedOutput> {
    const texts = Array.isArray(input.text) ? input.text : [input.text];

    const result: EmbeddingResult = await providerProxyService.createEmbeddings(
      "default",
      texts,
    );

    return {
      embeddings: result.embeddings,
      dimensions: result.dimensions,
      model: result.model,
      modelConfigId: result.modelConfigId,
      providerCode: result.providerCode,
    };
  },

  /**
   * 单文本向量化（便捷方法）
   * @param text 单个文本
   * @returns 单个向量
   */
  async embedSingle(text: string): Promise<{
    embedding: number[];
    dimensions: number;
    model: string;
    modelConfigId: string;
    providerCode: string;
  }> {
    const result = await this.embed({ text });
    return {
      embedding: result.embeddings[0] ?? [],
      dimensions: result.dimensions,
      model: result.model,
      modelConfigId: result.modelConfigId,
      providerCode: result.providerCode,
    };
  },

  async runNode(text: string): Promise<RagNodeResult<EmbedStatePatch>> {
    const startedAtMs = Date.now();
    const invocation = providerProxyService.describeEmbeddingInvocation(
      "default",
      [text],
    );
    const result = await this.embedSingle(text);
    return {
      state: {
        embedding: result.embedding,
        embeddingDimensions: result.dimensions,
        embeddingModel: result.model,
        embeddingModelConfigId: result.modelConfigId,
      },
      observation: createModelCallObservation({
        startedAtMs,
        label: "生成查询向量",
        summary: `向量生成完成，维度 ${result.dimensions}`,
        details: {
          dimensions: result.dimensions,
          model: result.model,
          modelConfigId: result.modelConfigId,
        },
        role: "embedding",
        providerCode: result.providerCode,
        providerLabel: invocation.providerLabel,
        protocol: invocation.protocol,
        operation: invocation.operation,
        endpoint: invocation.endpoint,
        model: result.model,
        modelConfigId: result.modelConfigId,
        params: invocation.params,
        request: invocation.request,
        result: {
          success: true,
          finishReason: "completed",
          metrics: {
            inputCount: 1,
            outputCount: result.embedding.length,
          },
          response: {
            model: result.model,
            summary: {
              dimensions: result.dimensions,
              vectorCount: 1,
            },
          },
        },
        context: {
          inputLength: Array.from(text).length,
        },
      }),
    };
  },
};
