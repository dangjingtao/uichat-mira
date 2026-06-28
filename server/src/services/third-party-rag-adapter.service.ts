import { knowledgeBaseService } from "@/services/knowledge-base.service.js";
import { ragPipeline } from "@/services/rag-pipeline.js";

export type ThirdPartyRagInput = {
  question: string;
  knowledgeBaseId?: string | null;
};

export type ThirdPartyRagResult = {
  answer: string;
  knowledgeBaseId: string | null;
};

const resolveKnowledgeBaseId = (knowledgeBaseId?: string | null) => {
  const normalized = knowledgeBaseId?.trim();
  if (!normalized) {
    return knowledgeBaseService.getDefaultKnowledgeBase().id;
  }

  const knowledgeBase = knowledgeBaseService.getKnowledgeBaseById(normalized);
  return knowledgeBase?.id ?? knowledgeBaseService.getDefaultKnowledgeBase().id;
};

export const thirdPartyRagAdapter = {
  async answer(input: ThirdPartyRagInput): Promise<ThirdPartyRagResult> {
    const knowledgeBaseId = resolveKnowledgeBaseId(input.knowledgeBaseId);
    const result = await ragPipeline.run({
      question: input.question,
      knowledgeBaseId,
    });

    return {
      answer: result.answer,
      knowledgeBaseId,
    };
  },
};
