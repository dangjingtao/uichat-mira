import type { ModelType } from "@/db/schema.js";
import { llmService } from "@/services/llm.service.js";
import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";
import type { ProviderInvocationMetadata, ProxyProviderParam } from "@/services/provider-proxy.service/types.js";
import type { RagNodeEnvironment, RagNodeResult } from "@/services/rag-node-contract.js";
import { createModelCallObservation } from "@/services/rag-node-observation.js";

export interface LlmNodeInput {
  roleType: ModelType;
  requestedProvider?: ProxyProviderParam;
  messages: NormalizedChatMessage[];
  params?: Record<string, unknown>;
  operation?: "chat" | "task-chat";
}

export interface LlmNodeRunInput<TStatePatch> extends LlmNodeInput {
  startedAtMs: number;
  label: string;
  state: TStatePatch;
  answer: string;
  summary?: string;
  details?: Record<string, unknown>;
  artifacts?: Record<string, unknown>;
  result?: RagNodeEnvironment["result"];
  retrieval?: RagNodeEnvironment["retrieval"];
  context?: RagNodeEnvironment["context"];
  sources?: RagNodeResult<TStatePatch>["observation"]["sources"];
}

const resolveOperation = (input: Pick<LlmNodeInput, "operation" | "roleType">) =>
  input.operation ?? (input.roleType === "task" ? "task-chat" : "chat");

const resolveProvider = (requestedProvider?: ProxyProviderParam) =>
  requestedProvider ?? "default";

const describeInvocation = (
  input: LlmNodeInput,
): ProviderInvocationMetadata =>
  llmService.describeTextInvocation({
    roleType: input.roleType,
    requestedProvider: resolveProvider(input.requestedProvider),
    messages: input.messages,
    operation: resolveOperation(input),
    ...(input.params ? { params: input.params } : {}),
  });

export const llmSharedNode = {
  streamText(input: LlmNodeInput) {
    return llmService.streamText({
      roleType: input.roleType,
      requestedProvider: resolveProvider(input.requestedProvider),
      messages: input.messages,
      ...(input.params ? { params: input.params } : {}),
    });
  },

  generateText(input: LlmNodeInput) {
    return llmService.generateText({
      roleType: input.roleType,
      requestedProvider: resolveProvider(input.requestedProvider),
      messages: input.messages,
      ...(input.params ? { params: input.params } : {}),
    });
  },

  describeInvocation,

  runTextNode<TStatePatch>(input: LlmNodeRunInput<TStatePatch>): RagNodeResult<TStatePatch> {
    const invocation = describeInvocation(input);

    return {
      state: input.state,
      observation: createModelCallObservation({
        startedAtMs: input.startedAtMs,
        label: input.label,
        ...(input.summary ? { summary: input.summary } : {}),
        ...(input.details ? { details: input.details } : {}),
        ...(input.artifacts ? { artifacts: input.artifacts } : {}),
        ...("sources" in input ? { sources: input.sources } : {}),
        role: input.roleType,
        providerCode: invocation.providerCode,
        providerLabel: invocation.providerLabel,
        protocol: invocation.protocol,
        operation: invocation.operation,
        endpoint: invocation.endpoint,
        model: invocation.model,
        modelConfigId: invocation.modelConfigId,
        params: invocation.params,
        request: invocation.request,
        result: input.result,
        retrieval: input.retrieval,
        context: input.context,
      }),
    };
  },
};
