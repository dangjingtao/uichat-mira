export const DEFAULT_TOP_K = 10;
export const DEFAULT_MIN_SCORE = 0.15;
export const TOOL_EXPOSURE_RECALL_THRESHOLD = 20;

const magnitude = (vector: number[]) =>
  Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

export const cosineSimilarity = (left: number[], right: number[]) => {
  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return -1;
  }

  const leftMagnitude = magnitude(left);
  const rightMagnitude = magnitude(right);
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return -1;
  }

  let dotProduct = 0;
  for (let index = 0; index < left.length; index += 1) {
    dotProduct += (left[index] ?? 0) * (right[index] ?? 0);
  }

  return dotProduct / (leftMagnitude * rightMagnitude);
};

export const toReason = (input: {
  title: string;
  embeddingScore: number;
  rerankScore: number;
  finalScore: number;
}) =>
  [
    `matched ${input.title}`,
    `final=${input.finalScore.toFixed(4)}`,
    `embedding=${input.embeddingScore.toFixed(4)}`,
    `rerank=${input.rerankScore.toFixed(4)}`,
  ].join("; ");
