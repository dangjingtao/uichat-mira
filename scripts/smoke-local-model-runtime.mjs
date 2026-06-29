import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as ort from "onnxruntime-web";
import { Tokenizer } from "@huggingface/tokenizers";
import loadLocalEnv from "./load-local-env.cjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
loadLocalEnv(rootDir);
const rawRoot =
  process.env.LOCAL_MODEL_RAW_ROOT?.trim() || "";
const wasmRoot =
  process.env.LOCAL_ONNX_WASM_ROOT?.trim() || "";

if (!rawRoot) {
  throw new Error("LOCAL_MODEL_RAW_ROOT is not set");
}
if (!wasmRoot) {
  throw new Error("LOCAL_ONNX_WASM_ROOT is not set");
}

ort.env.wasm.wasmPaths = `${pathToFileURL(wasmRoot).href}/`;
ort.env.wasm.numThreads = 1;

const loadJson = async (filePath) =>
  JSON.parse(await fs.readFile(filePath, "utf8"));

const loadTokenizer = async (modelDir) => {
  const tokenizerJson = await loadJson(path.join(modelDir, "tokenizer.json"));
  const tokenizerConfig = await loadJson(
    path.join(modelDir, "tokenizer_config.json"),
  );
  return new Tokenizer(tokenizerJson, tokenizerConfig);
};

const toBigIntTensor = (name, values, shape) =>
  new ort.Tensor(name, BigInt64Array.from(values.map(BigInt)), shape);

const toNumberArray = (value) => {
  if (ArrayBuffer.isView(value)) {
    return Array.from(value);
  }
  return value;
};

const normalize = (vector) => {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return norm > 0 ? vector.map((value) => value / norm) : vector;
};

const meanPool = (lastHiddenState, attentionMask, shape) => {
  const [, sequenceLength, hiddenSize] = shape;
  const output = new Array(hiddenSize).fill(0);
  let activeTokens = 0;

  for (let tokenIndex = 0; tokenIndex < sequenceLength; tokenIndex += 1) {
    if (!attentionMask[tokenIndex]) {
      continue;
    }
    activeTokens += 1;
    const offset = tokenIndex * hiddenSize;
    for (let hiddenIndex = 0; hiddenIndex < hiddenSize; hiddenIndex += 1) {
      output[hiddenIndex] += lastHiddenState[offset + hiddenIndex];
    }
  }

  const divisor = Math.max(activeTokens, 1);
  return output.map((value) => value / divisor);
};

const createSession = async (modelDir) =>
  ort.InferenceSession.create(path.join(modelDir, "onnx", "model_quantized.onnx"), {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

const resolveOutput = (outputs, preferredNames) => {
  for (const name of preferredNames) {
    if (outputs[name]) {
      return outputs[name];
    }
  }
  return Object.values(outputs)[0];
};

const runEmbeddingSmoke = async () => {
  const modelDir = path.join(rawRoot, "embedding", "multilingual-e5-small");
  const tokenizer = await loadTokenizer(modelDir);
  const session = await createSession(modelDir);
  const text = "query: 本地知识库检索需要稳定的向量表示";
  const encoded = tokenizer.encode(text);
  const ids = toNumberArray(encoded.ids);
  const attentionMask = toNumberArray(encoded.attention_mask);
  const tokenTypeIds = encoded.type_ids
    ? toNumberArray(encoded.type_ids)
    : new Array(ids.length).fill(0);

  const outputs = await session.run({
    input_ids: toBigIntTensor("int64", ids, [1, ids.length]),
    attention_mask: toBigIntTensor("int64", attentionMask, [1, ids.length]),
    token_type_ids: toBigIntTensor("int64", tokenTypeIds, [1, ids.length]),
  });

  const output = resolveOutput(outputs, ["last_hidden_state"]);
  const embedding = normalize(
    meanPool(Array.from(output.data), attentionMask, output.dims),
  );

  return {
    model: "Xenova/multilingual-e5-small",
    tokens: ids.length,
    dimensions: embedding.length,
    norm: Math.sqrt(embedding.reduce((sum, value) => sum + value * value, 0)),
    sample: embedding.slice(0, 8),
  };
};

const sigmoid = (value) => 1 / (1 + Math.exp(-value));

const runRerankSmoke = async () => {
  const modelDir = path.join(rawRoot, "rerank", "ms-marco-MiniLM-L-6-v2");
  const tokenizer = await loadTokenizer(modelDir);
  const session = await createSession(modelDir);
  const query = "context budget 如何避免长对话爆炸？";
  const passages = [
    "通过 token 审计和动态裁剪，可以优先保留当前用户问题、系统指令和最近历史。",
    "Electron 打包时要处理图标、窗口大小和安装器配置。",
  ];

  const results = [];
  for (const passage of passages) {
    const encoded = tokenizer.encode(query, {
      text_pair: passage,
      return_token_type_ids: true,
    });
    const ids = toNumberArray(encoded.ids);
    const attentionMask = toNumberArray(encoded.attention_mask);
    const tokenTypeIds = encoded.type_ids
      ? toNumberArray(encoded.type_ids)
      : new Array(ids.length).fill(0);

    const outputs = await session.run({
      input_ids: toBigIntTensor("int64", ids, [1, ids.length]),
      attention_mask: toBigIntTensor("int64", attentionMask, [1, ids.length]),
      token_type_ids: toBigIntTensor("int64", tokenTypeIds, [1, ids.length]),
    });
    const logits = resolveOutput(outputs, ["logits"]);
    const score = Number(logits.data[0]);
    results.push({
      passage,
      tokens: ids.length,
      score,
      probability: sigmoid(score),
    });
  }

  return {
    model: "Xenova/ms-marco-MiniLM-L-6-v2",
    results: results.sort((a, b) => b.score - a.score),
  };
};

const main = async () => {
  console.log("Local model runtime smoke test");
  console.log(`rawRoot=${rawRoot}`);
  console.log(`wasmRoot=${wasmRoot}`);

  const embedding = await runEmbeddingSmoke();
  console.log("\nEmbedding:");
  console.log(JSON.stringify(embedding, null, 2));

  const rerank = await runRerankSmoke();
  console.log("\nRerank:");
  console.log(JSON.stringify(rerank, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
