import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
  LocalEmbeddingResult,
  LocalModelManifest,
  LocalModelManifestEntry,
  LocalRerankCandidate,
  LocalRerankResult,
} from "./types.js";
import {
  resetLocalModelResourcesForTests,
  resolveLocalModelResources,
} from "./resource-resolver.js";

type OrtModule = typeof import("onnxruntime-web");
type TokenizersModule = typeof import("@huggingface/tokenizers");
type InferenceSession = Awaited<
  ReturnType<OrtModule["InferenceSession"]["create"]>
>;
type TokenizerInstance = InstanceType<TokenizersModule["Tokenizer"]>;

interface RuntimeModel {
  manifest: LocalModelManifestEntry;
  modelDir: string;
  session: InferenceSession;
  tokenizer: TokenizerInstance;
}

const EMBEDDING_MODEL_ID = "multilingual-e5-small";
const RERANK_MODEL_ID = "ms-marco-MiniLM-L-6-v2";

let ortModulePromise: Promise<OrtModule> | null = null;
let tokenizersModulePromise: Promise<TokenizersModule> | null = null;
const modelCache = new Map<string, Promise<RuntimeModel>>();

const resolveRequiredPath = (envName: string) => {
  const value = process.env[envName]?.trim();
  if (!value) {
    throw new Error(
      `${envName} is not set. Local model runtime requires an explicit model resource path.`,
    );
  }
  return path.resolve(value);
};

const resolveWasmRoot = () => resolveRequiredPath("LOCAL_ONNX_WASM_ROOT");

const loadOrt = async () => {
  ortModulePromise ??= import("onnxruntime-web").then((ort) => {
    const wasmRoot = resolveWasmRoot();
    ort.env.wasm.wasmPaths = `${pathToFileURL(wasmRoot).href}/`;
    ort.env.wasm.numThreads = 1;
    return ort;
  });
  return ortModulePromise;
};

const loadTokenizers = async () => {
  tokenizersModulePromise ??= import("@huggingface/tokenizers");
  return tokenizersModulePromise;
};

const loadJson = async <T>(filePath: string): Promise<T> =>
  JSON.parse(await fs.readFile(filePath, "utf8")) as T;

const loadManifest = async () => (await resolveLocalModelResources()).manifest;

const findModelManifest = async (
  family: LocalModelManifestEntry["family"],
  modelId: string,
) => {
  const manifest = await loadManifest();
  const model = manifest.models.find(
    (entry) => entry.family === family && entry.id === modelId,
  );
  if (!model) {
    throw new Error(`Local ${family} model "${modelId}" is not installed`);
  }
  return model;
};

const loadTokenizer = async (modelDir: string) => {
  const { Tokenizer } = await loadTokenizers();
  const tokenizerJson = await loadJson<Record<string, unknown>>(
    path.join(modelDir, "tokenizer.json"),
  );
  const tokenizerConfig = await loadJson<Record<string, unknown>>(
    path.join(modelDir, "tokenizer_config.json"),
  );
  return new Tokenizer(tokenizerJson, tokenizerConfig);
};

const loadModel = async (
  family: LocalModelManifestEntry["family"],
  modelId: string,
) => {
  const cacheKey = `${family}:${modelId}`;
  let cached = modelCache.get(cacheKey);
  if (!cached) {
    cached = (async () => {
      const [ort, resources, manifest] = await Promise.all([
        loadOrt(),
        resolveLocalModelResources(),
        findModelManifest(family, modelId),
      ]);
      const modelDir = path.join(resources.rawRoot, manifest.path);
      const [session, tokenizer] = await Promise.all([
        ort.InferenceSession.create(
          path.join(modelDir, "onnx", "model_quantized.onnx"),
          {
            executionProviders: ["wasm"],
            graphOptimizationLevel: "all",
          },
        ),
        loadTokenizer(modelDir),
      ]);
      return {
        manifest,
        modelDir,
        session,
        tokenizer,
      };
    })();
    modelCache.set(cacheKey, cached);
  }
  return cached;
};

const toNumberArray = (value: unknown): number[] =>
  ArrayBuffer.isView(value)
    ? Array.from(value as unknown as ArrayLike<number>)
    : Array.isArray(value) && value.every((item) => typeof item === "number")
      ? value
      : [];

const toBigIntTensor = async (
  values: number[],
  shape: readonly number[],
) => {
  const ort = await loadOrt();
  return new ort.Tensor("int64", BigInt64Array.from(values.map(BigInt)), [
    ...shape,
  ]);
};

const createTextFeeds = async (
  encoded: {
    ids: unknown;
    attention_mask: unknown;
    type_ids?: unknown;
  },
) => {
  const ids = toNumberArray(encoded.ids);
  const attentionMask = toNumberArray(encoded.attention_mask);
  const tokenTypeIds = encoded.type_ids
    ? toNumberArray(encoded.type_ids)
    : new Array(ids.length).fill(0);

  return {
    feeds: {
      input_ids: await toBigIntTensor(ids, [1, ids.length]),
      attention_mask: await toBigIntTensor(attentionMask, [1, ids.length]),
      token_type_ids: await toBigIntTensor(tokenTypeIds, [1, ids.length]),
    },
    attentionMask,
    tokenCount: ids.length,
  };
};

const resolveOutput = <T>(outputs: Record<string, T>, preferredNames: string[]) => {
  for (const name of preferredNames) {
    if (outputs[name]) {
      return outputs[name];
    }
  }
  const firstOutput = Object.values(outputs)[0];
  if (!firstOutput) {
    throw new Error("Local ONNX model returned no outputs");
  }
  return firstOutput;
};

const normalize = (vector: number[]) => {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
};

const meanPool = (
  lastHiddenState: unknown,
  attentionMask: number[],
  dims: readonly number[],
) => {
  const values = toNumberArray(lastHiddenState);
  const sequenceLength = dims[1] ?? 0;
  const hiddenSize = dims[2] ?? 0;
  const output = new Array(hiddenSize).fill(0);
  let activeTokens = 0;

  for (let tokenIndex = 0; tokenIndex < sequenceLength; tokenIndex += 1) {
    if (!attentionMask[tokenIndex]) {
      continue;
    }
    activeTokens += 1;
    const offset = tokenIndex * hiddenSize;
    for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
      output[hiddenIndex] += values[offset + hiddenIndex] ?? 0;
    }
  }

  const divisor = Math.max(activeTokens, 1);
  return output.map((value) => value / divisor);
};

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

export const localModelRuntime = {
  async embedTexts(texts: string[]): Promise<LocalEmbeddingResult> {
    const model = await loadModel("embedding", EMBEDDING_MODEL_ID);
    const normalizedTexts = texts.map((text) => text.trim()).filter(Boolean);
    const embeddings: number[][] = [];

    for (const text of normalizedTexts) {
      const encoded = model.tokenizer.encode(`query: ${text}`);
      const { feeds, attentionMask } = await createTextFeeds(encoded);
      const outputs = await model.session.run(feeds);
      const output = resolveOutput(outputs, ["last_hidden_state"]);
      embeddings.push(normalize(meanPool(output.data, attentionMask, output.dims)));
    }

    return {
      embeddings,
      dimensions: model.manifest.dimensions ?? embeddings[0]?.length ?? 0,
      model: model.manifest.source,
      modelConfigId: `local:${model.manifest.id}`,
      providerCode: "local",
      runtime: "onnxruntime-web/wasm",
    };
  },

  async rerank<TMeta = unknown>(input: {
    query: string;
    candidates: Array<LocalRerankCandidate<TMeta>>;
    topN?: number;
  }): Promise<LocalRerankResult<TMeta>> {
    const model = await loadModel("rerank", RERANK_MODEL_ID);
    const scored = [];

    for (const candidate of input.candidates) {
      const encoded = model.tokenizer.encode(input.query, {
        text_pair: candidate.text,
        return_token_type_ids: true,
      });
      const { feeds } = await createTextFeeds(encoded);
      const outputs = await model.session.run(feeds);
      const logits = resolveOutput(outputs, ["logits"]);
      const score = Number(logits.data[0] ?? 0);
      scored.push({
        ...candidate,
        score,
        probability: sigmoid(score),
      });
    }

    return {
      candidates: scored
        .sort((a, b) => b.score - a.score)
        .slice(0, input.topN ?? scored.length)
        .map((candidate, index) => ({
          ...candidate,
          rank: index + 1,
        })),
      model: model.manifest.source,
      modelConfigId: `local:${model.manifest.id}`,
      providerCode: "local",
      runtime: "onnxruntime-web/wasm",
    };
  },

  resetForTests() {
    resetLocalModelResourcesForTests();
    modelCache.clear();
  },
};

export type {
  LocalEmbeddingResult,
  LocalModelManifest,
  LocalModelManifestEntry,
  LocalRerankCandidate,
  LocalRerankResult,
} from "./types.js";
