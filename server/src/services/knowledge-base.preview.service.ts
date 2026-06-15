import {
  splitDocumentText,
  type ChunkingConfig,
  type ChunkingPreviewResult,
  type SplitChunk,
} from "@/services/knowledge-base.splitter.js";

const DEFAULT_PREVIEW_SAMPLE_COUNT = 10;

export interface ChunkPreviewSample {
  id: string;
  index: number;
  text: string;
  charCount: number;
}

export interface ChunkPreviewResult {
  totalChunks: number;
  stats: ChunkingPreviewResult["stats"];
  effectiveConfig: ChunkingPreviewResult["chunkingConfig"];
  sampleChunks: ChunkPreviewSample[];
}

const toSampleChunk = (chunk: SplitChunk): ChunkPreviewSample => ({
  id: `chunk-${chunk.chunkIndex}`,
  index: chunk.chunkIndex,
  text: chunk.content,
  charCount: chunk.charCount,
});

const getPreviewSampleIndices = (totalChunks: number, sampleCount: number) => {
  if (totalChunks <= sampleCount) {
    return Array.from({ length: totalChunks }, (_, index) => index);
  }

  const indices = new Set<number>();
  const step = totalChunks / sampleCount;

  for (let index = 0; index < sampleCount; index += 1) {
    const base = Math.floor(index * step);
    const jitterWindow = Math.max(1, Math.floor(step / 3));
    const jitter = Math.floor(Math.random() * jitterWindow);
    indices.add(Math.min(totalChunks - 1, base + jitter));
  }

  while (indices.size < sampleCount) {
    indices.add(Math.floor(Math.random() * totalChunks));
  }

  return Array.from(indices).sort((left, right) => left - right);
};

const samplePreviewChunks = (
  chunks: SplitChunk[],
  sampleCount = DEFAULT_PREVIEW_SAMPLE_COUNT,
) =>
  getPreviewSampleIndices(chunks.length, sampleCount).map((index) =>
    toSampleChunk(chunks[index]),
  );

export const knowledgeBasePreviewService = {
  async previewChunks(params: {
    rawText: string;
    chunkingConfig?: Partial<ChunkingConfig> | null;
    sampleCount?: number;
  }): Promise<ChunkPreviewResult> {
    const result = await splitDocumentText(params.rawText, params.chunkingConfig);

    return {
      totalChunks: result.stats.totalChunks,
      stats: result.stats,
      effectiveConfig: result.chunkingConfig,
      sampleChunks: samplePreviewChunks(
        result.chunks,
        params.sampleCount ?? DEFAULT_PREVIEW_SAMPLE_COUNT,
      ),
    };
  },
};
