export type ComfyUiConnectionStatus =
  | "unconfigured"
  | "unverified"
  | "connectable"
  | "failed";

export type ComfyUiFlowAsset = {
  id: string;
  name: string;
  note: string;
  updatedAt: string;
  source: "template" | "upload" | "manual";
  rawJson: string;
};

export const defaultComfyUiFlows: ComfyUiFlowAsset[] = [
  {
    id: "txt2img",
    name: "SDXL Text to Image",
    note: "标准文本生图 workflow，适合先验证 prompt 和 seed 覆盖链路。",
    updatedAt: "2026-07-02 14:20",
    source: "template",
    rawJson:
      '{\n  "6": { "class_type": "CLIPTextEncode", "inputs": { "text": "" } },\n  "3": { "class_type": "KSampler", "inputs": { "seed": 0 } }\n}',
  },
  {
    id: "img2img",
    name: "Reference Image Remix",
    note: "参考图重绘 workflow，用来验证图生图的基础入口形态。",
    updatedAt: "2026-06-28 09:40",
    source: "upload",
    rawJson:
      '{\n  "10": { "class_type": "LoadImage", "inputs": {} },\n  "3": { "class_type": "KSampler", "inputs": { "denoise": 0.5 } }\n}',
  },
];

