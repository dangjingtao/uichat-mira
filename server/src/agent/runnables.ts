import { RunnableLambda } from "@langchain/core/runnables";
import { executeHarnessInvocation } from "@/mcp/harness/invocations.js";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import { ragRunnableSequence, retrieveOnlyRunnable } from "@/services/rag-runables.js";

export const agentRetrieveRunnable = retrieveOnlyRunnable;
export const agentRagRunnable = ragRunnableSequence;

export const agentHarnessInvocationRunnable = RunnableLambda.from(
  async (input: {
    toolId: string;
    args?: Record<string, unknown>;
    userId: number;
    threadId: string;
    turnId?: string;
  }) =>
    executeHarnessInvocation({
      toolId: input.toolId,
      args: input.args,
      userId: input.userId,
      threadId: input.threadId,
      turnId: input.turnId,
    }),
);

export const agentGenerateTextRunnable = RunnableLambda.from(
  async (input: {
    messages: NormalizedChatMessage[];
    params?: Record<string, unknown>;
  }) => providerProxyService.generateTextForRole("llm", input.messages, input.params),
);

