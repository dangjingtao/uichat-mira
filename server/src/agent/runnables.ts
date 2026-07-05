import { RunnableLambda } from "@langchain/core/runnables";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol";
import { ragRunnableSequence, retrieveOnlyRunnable } from "@/services/rag-runables";

export const agentRetrieveRunnable = retrieveOnlyRunnable;
export const agentRagRunnable = ragRunnableSequence;

export const agentGenerateTextRunnable = RunnableLambda.from(
  async (input: {
    messages: NormalizedChatMessage[];
    params?: Record<string, unknown>;
  }) => providerProxyService.generateTextForRole("llm", input.messages, input.params),
);
