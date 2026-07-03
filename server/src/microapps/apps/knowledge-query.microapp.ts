import type { MicroAppDefinition } from "../types.js";
import { thirdPartyRagAdapter } from "@/services/third-party-rag-adapter.service.js";

const fallbackAnswer = "我没有检索到可用答案。";

export const knowledgeQueryMicroApp: MicroAppDefinition = {
  type: "knowledge_query",
  label: "知识库调用",
  description: "接收外部问答入口的文本问题，调用本地知识库检索链路，并返回一条稳定文本回复。",
  runtimeKey: "knowledge-query",
  supportedAccessPoints: ["wecom.smart_robot"],
  bindingSchema: {
    fields: [
      {
        key: "knowledgeBaseId",
        label: "知识库",
        type: "knowledge_base_select",
        required: true,
        description: "这个接入点收到问题后，将使用这里指定的知识库执行检索问答。",
        defaultValue: "",
      },
    ],
  },
  async invoke(microApp, binding, request) {
    const question = request.text?.trim() ?? "";
    if (!question) {
      return {
        mode: "no_reply",
        meta: { reason: "empty_question" },
      };
    }

    const bindingKnowledgeBaseId =
      typeof binding.config.knowledgeBaseId === "string"
        ? binding.config.knowledgeBaseId.trim()
        : "";

    const result = await thirdPartyRagAdapter.answer({
      question,
      knowledgeBaseId: bindingKnowledgeBaseId || undefined,
    });
    const answer = result.answer?.trim() || fallbackAnswer;

    return {
      mode: "reply",
      message: {
        type: "text",
        content: answer,
      },
      meta: {
        knowledgeBaseId: result.knowledgeBaseId,
      },
    };
  },
};
