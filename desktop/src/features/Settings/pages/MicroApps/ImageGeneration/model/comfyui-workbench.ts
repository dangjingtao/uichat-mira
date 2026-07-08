export type ComfyUiConnectionStatus =
  | "unconfigured"
  | "unverified"
  | "connectable"
  | "failed";

export type ComfyUiNodeMapping = {
  promptPath: string;
  seedPath: string;
  widthPath: string;
  heightPath: string;
  outputNodeId: string;
  previewNodeId: string;
};

export type ComfyUiFlowAsset = {
  id: string;
  name: string;
  note: string;
  updatedAt: string;
  source: "template" | "upload" | "manual";
  rawJson: string;
  mapping: ComfyUiNodeMapping;
};

export type ComfyUiNodeSummary = {
  id: string;
  classType: string;
  title: string;
};

export type ComfyUiExecutionOverrides = {
  prompt: string;
  seed: string;
  size: string;
};

export const emptyComfyUiNodeMapping = (): ComfyUiNodeMapping => ({
  promptPath: "",
  seedPath: "",
  widthPath: "",
  heightPath: "",
  outputNodeId: "",
  previewNodeId: "",
});

const cloneWorkflowJson = (value: string) =>
  JSON.parse(value) as Record<string, { inputs?: Record<string, unknown> }>;

const parseNodeFieldPath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const separatorIndex = trimmed.indexOf(".");
  if (separatorIndex <= 0 || separatorIndex === trimmed.length - 1) {
    return null;
  }

  const nodeId = trimmed.slice(0, separatorIndex).trim();
  const fieldPath = trimmed
    .slice(separatorIndex + 1)
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!nodeId || fieldPath.length === 0) {
    return null;
  }

  return {
    nodeId,
    fieldPath,
  };
};

const setNestedValue = (
  target: Record<string, unknown>,
  fieldPath: string[],
  value: unknown,
) => {
  let current: Record<string, unknown> = target;

  for (let index = 0; index < fieldPath.length - 1; index += 1) {
    const key = fieldPath[index];
    const next = current[key];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[fieldPath[fieldPath.length - 1]] = value;
};

const applyPathValue = (
  workflow: Record<string, { inputs?: Record<string, unknown> }>,
  path: string,
  value: unknown,
) => {
  const parsed = parseNodeFieldPath(path);
  if (!parsed) {
    return false;
  }

  const node = workflow[parsed.nodeId];
  if (!node) {
    return false;
  }

  if (!node.inputs || typeof node.inputs !== "object" || Array.isArray(node.inputs)) {
    node.inputs = {};
  }

  setNestedValue(node.inputs, parsed.fieldPath, value);
  return true;
};

const parseSize = (value: string) => {
  const match = value.trim().match(/^(\d+)\s*[xX×]\s*(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
};

export const composeComfyUiWorkflowJson = ({
  rawJson,
  mapping,
  overrides,
}: {
  rawJson: string;
  mapping: ComfyUiNodeMapping;
  overrides: ComfyUiExecutionOverrides;
}) => {
  const workflow = cloneWorkflowJson(rawJson);
  const seedValue = overrides.seed.trim();
  const parsedSize = parseSize(overrides.size);

  if (overrides.prompt.trim()) {
    applyPathValue(workflow, mapping.promptPath, overrides.prompt.trim());
  }

  if (seedValue) {
    const parsedSeed = Number(seedValue);
    applyPathValue(
      workflow,
      mapping.seedPath,
      Number.isNaN(parsedSeed) ? seedValue : parsedSeed,
    );
  }

  if (parsedSize) {
    applyPathValue(workflow, mapping.widthPath, parsedSize.width);
    applyPathValue(workflow, mapping.heightPath, parsedSize.height);
  }

  return JSON.stringify(workflow, null, 2);
};

export const getComfyUiNodeSummaries = (
  rawJson: string,
): ComfyUiNodeSummary[] => {
  const trimmed = rawJson.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const workflow = JSON.parse(trimmed) as Record<
      string,
      { class_type?: string; _meta?: { title?: string } }
    >;

    return Object.entries(workflow).map(([id, node]) => ({
      id,
      classType: String(node?.class_type ?? "Unknown"),
      title: node?._meta?.title?.trim() || String(node?.class_type ?? "Unknown"),
    }));
  } catch {
    return [];
  }
};

export const defaultComfyUiFlows: ComfyUiFlowAsset[] = [
  {
    id: "txt2img",
    name: "SDXL Text to Image",
    note: "标准文本生图 workflow，适合先验证 prompt 和 seed 覆盖链路。",
    updatedAt: "2026-07-02 14:20",
    source: "template",
    rawJson:
      '{\n  "6": { "class_type": "CLIPTextEncode", "inputs": { "text": "" }, "_meta": { "title": "正向提示词" } },\n  "13": { "class_type": "EmptyLatentImage", "inputs": { "width": 1024, "height": 1024, "batch_size": 1 }, "_meta": { "title": "空 Latent" } },\n  "3": { "class_type": "KSampler", "inputs": { "seed": 0 }, "_meta": { "title": "采样器" } },\n  "9": { "class_type": "SaveImage", "inputs": { "filename_prefix": "sdxl-debug", "images": ["8", 0] }, "_meta": { "title": "保存图像" } }\n}',
    mapping: {
      promptPath: "6.text",
      seedPath: "3.seed",
      widthPath: "13.width",
      heightPath: "13.height",
      outputNodeId: "9",
      previewNodeId: "9",
    },
  },
  {
    id: "img2img",
    name: "Reference Image Remix",
    note: "参考图重绘 workflow，用来验证图生图的基础入口形态。",
    updatedAt: "2026-06-28 09:40",
    source: "upload",
    rawJson:
      '{\n  "10": { "class_type": "LoadImage", "inputs": {}, "_meta": { "title": "参考图输入" } },\n  "6": { "class_type": "CLIPTextEncode", "inputs": { "text": "" }, "_meta": { "title": "正向提示词" } },\n  "13": { "class_type": "EmptyLatentImage", "inputs": { "width": 1024, "height": 1024, "batch_size": 1 }, "_meta": { "title": "空 Latent" } },\n  "3": { "class_type": "KSampler", "inputs": { "seed": 0, "denoise": 0.5 }, "_meta": { "title": "采样器" } },\n  "9": { "class_type": "PreviewImage", "inputs": { "images": ["8", 0] }, "_meta": { "title": "预览图像" } }\n}',
    mapping: {
      promptPath: "6.text",
      seedPath: "3.seed",
      widthPath: "13.width",
      heightPath: "13.height",
      outputNodeId: "9",
      previewNodeId: "9",
    },
  },
];
