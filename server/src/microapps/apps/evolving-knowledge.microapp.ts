import type { MicroAppDefinition } from "../types.js";

export const evolvingKnowledgeMicroApp: MicroAppDefinition = {
  type: "evolving_knowledge",
  label: "智识进化库",
  description:
    "多媒体知识捕获与 AI 自我整理系统。捕获网页、图片、音频、视频，AI 自动重写、标签、发现概念关联与跨时间洞见。",
  runtimeKey: "evolving_knowledge",
  supportedAccessPoints: ["desktop.evolving_knowledge_studio"],
  bindingSchema: {
    fields: [],
  },
  async invoke() {
    return {
      mode: "error",
      errorCode: "evolving_knowledge_studio_only",
      errorMessage:
        "智识进化库当前只提供桌面 Studio 调试能力，不承接外部接入点调用。",
    };
  },
};
