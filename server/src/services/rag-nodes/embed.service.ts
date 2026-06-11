import {
  providerProxyService,
  type EmbeddingResult,
} from "@/services/provider-proxy.service";

export interface EmbedInput {
  text: string | string[];
}

export interface EmbedOutput {
  embeddings: number[][];
  dimensions: number;
  model: string;
  providerCode: string;
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
      providerCode: result.providerCode,
    };
  },

  /**
   * 单文本向量化（便捷方法）
   * @param text 单个文本
   * @returns 单个向量
   */
  async embedSingle(text: string): Promise<number[]> {
    const result = await this.embed({ text });
    return result.embeddings[0] ?? [];
  },
};
