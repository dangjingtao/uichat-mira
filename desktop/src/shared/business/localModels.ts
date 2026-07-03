import type { RoleModelType } from "@/shared/api/modelSettings";

export type BuiltInLocalModel = {
  role: Extract<RoleModelType, "embedding" | "rerank">;
  modelId: string;
  displayName: string;
  runtime: string;
  source: string;
  dimensions?: number;
  optional: boolean;
};

export const BUILT_IN_LOCAL_MODELS: Record<
  Extract<RoleModelType, "embedding" | "rerank">,
  BuiltInLocalModel
> = {
  embedding: {
    role: "embedding",
    modelId: "multilingual-e5-small",
    displayName: "multilingual-e5-small",
    runtime: "onnxruntime-web / WASM",
    source: "local",
    dimensions: 384,
    optional: false,
  },
  rerank: {
    role: "rerank",
    modelId: "ms-marco-MiniLM-L-6-v2",
    displayName: "ms-marco-MiniLM-L-6-v2",
    runtime: "onnxruntime-web / WASM",
    source: "local",
    optional: true,
  },
};

export function getBuiltInLocalModel(
  role: RoleModelType,
): BuiltInLocalModel | null {
  if (role === "embedding" || role === "rerank") {
    return BUILT_IN_LOCAL_MODELS[role];
  }

  return null;
}
