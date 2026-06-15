# RAG Node Development Guide

## Purpose

This document is the developer-facing contract for the project's RAG node architecture.

Use it when you need to:

- add a new RAG node
- refactor an existing node
- extend frontend observability
- review whether a node implementation matches the current architecture

For the end-to-end runtime flow, see:

- `../rag-langgraph-flow.md`

## Architecture Responsibilities

### Node service

Node services live under `server/src/services/rag-nodes/`.

Each node is responsible for:

- doing exactly one business step
- exposing a `runNode(...)` method
- returning business state through `state`
- returning frontend-observable execution metadata through `observation`

Each node is not responsible for:

- orchestrating the whole pipeline
- emitting SSE directly
- hardcoding frontend cards or step sequences
- assembling ad hoc event payloads outside the standard contract

### Observation builders

Shared observation helpers live in:

- `server/src/services/rag-node-observation.ts`

They exist to centralize:

- timing structure
- model environment structure
- retrieval environment structure
- common observation payload shape

Review standard:

- if two nodes are assembling similar `environment` JSON by hand, that is usually a design smell

### Graph

Graph orchestration lives in:

- `server/src/services/rag-graph.ts`

The graph is responsible for:

- ordering nodes
- branching between nodes
- consuming node `state`
- broadcasting node lifecycle events from node `observation`

The graph should not:

- invent node-specific copy that the node did not provide
- duplicate node business logic
- turn into a second node-implementation layer

### Pipeline

External protocol adaptation lives in:

- `server/src/services/rag-pipeline.ts`

The pipeline is responsible for:

- calling the graph for non-streaming and streaming runs
- forwarding graph custom events to SSE-compatible frontend events
- preserving transport compatibility with the existing frontend

The pipeline should not:

- own node display semantics
- hardcode step cards
- reconstruct node observability from raw state patches

### Frontend

Frontend parsing and rendering should consume dynamic node events rather than fixed workflow assumptions.

Current related files include:

- `desktop/src/shared/ui/Thread/thread.types.ts`
- `desktop/src/shared/ui/Thread/thread.parsers.ts`
- `desktop/src/shared/ui/Thread/RagExecutionTrace.tsx`
- `desktop/src/shared/ui/RagProgressDetailDrawer.tsx`

Review standard:

- the frontend can decide how to render a node event
- the frontend should not need a hardcoded list of backend workflow steps to know what happened

## Standard Node IO

## Input

Graph code prepares each node's minimum required input from upstream state and runtime options.

Typical inputs include:

- current user question
- rewritten retrieval question
- conversation history
- embedding vector
- retrieved chunks
- runtime retrieval parameters such as `topK` and `topN`

Node inputs should stay narrow and explicit.

Review standard:

- do not pass a huge graph state object into every node just because it is convenient

## Output

Every observable node should return `RagNodeResult<TStatePatch>` from `runNode(...)`.

Canonical shape:

```ts
type RagNodeResult<TStatePatch> = {
  state: TStatePatch;
  observation: {
    label: string;
    summary?: string;
    details?: Record<string, unknown>;
    sources?: RetrievedChunk[];
    environment?: {
      model?: {
        role?: "task" | "llm" | "embedding" | "rerank" | string;
        providerCode?: string;
        providerLabel?: string;
        protocol?: string;
        operation?: string;
        endpoint?: string;
        model?: string;
        modelConfigId?: string;
        params?: Record<string, unknown>;
        request?: {
          method?: string;
          url?: string;
          body?: Record<string, unknown>;
        };
      };
      result?: {
        success?: boolean;
        finishReason?: string;
        statusCode?: number;
        error?: {
          code?: string;
          type?: string;
          message: string;
        };
        usage?: {
          inputTokens?: number;
          outputTokens?: number;
          totalTokens?: number;
        };
        metrics?: {
          inputCount?: number;
          outputCount?: number;
          returnedCount?: number;
          candidateCount?: number;
        };
        response?: {
          requestId?: string;
          model?: string;
          summary?: Record<string, unknown>;
        };
      };
      retrieval?: {
        knowledgeBaseId?: string | null;
        topK?: number | null;
        topN?: number | null;
        candidateCount?: number | null;
        returnedCount?: number | null;
      };
      timing?: {
        startedAt: string;
        finishedAt: string;
        durationMs: number;
      };
      context?: Record<string, unknown>;
    };
  };
};
```

Meaning:

- `state` is the business result written back into graph state
- `observation` is the node's standard output for frontend observability
- `sources` is the explicit source payload the graph may broadcast
- `environment` is the structured runtime envelope used by frontend inspection and debugging

## Environment Contract

All nodes should return `environment` whenever practical.

Minimum requirement:

- `environment.timing.startedAt`
- `environment.timing.finishedAt`
- `environment.timing.durationMs`

Model-invoking nodes must include:

- `environment.model.role`
- `environment.model.providerCode` when resolvable
- `environment.model.providerLabel` when resolvable
- `environment.model.protocol` when resolvable
- `environment.model.operation` when resolvable
- `environment.model.endpoint` when resolvable
- `environment.model.model` when resolvable
- `environment.model.modelConfigId` when resolvable
- `environment.model.params` when the invocation has meaningful parameters
- `environment.model.request.method`
- `environment.model.request.url`
- `environment.model.request.body` when a safe structured request summary is available

Retrieval-oriented nodes should include:

- `environment.retrieval.knowledgeBaseId` when applicable
- `environment.retrieval.topK` or `topN` when applicable
- `environment.retrieval.candidateCount` when applicable
- `environment.retrieval.returnedCount` when applicable

Use `environment.context` for structured supplemental data that does not belong in `model`, `retrieval`, or `timing`.

Use `environment.result` for normalized execution outcome data that the frontend should be able to compare across nodes.

Recommended minimum for completed nodes:

- `environment.result.success`
- `environment.result.finishReason`
- `environment.result.metrics`
- `environment.result.response.summary`

Review standard:

- do not invent sibling fields beside `model`, `retrieval`, `timing`, and `context` unless the contract is intentionally expanded for all nodes

## Broadcast Contract

The graph owns lifecycle broadcasting, based on node output.

Current rule set:

- graph emits `rag-node` with phase `start` when a node begins
- graph emits `rag-node` with phase `done` using node `observation` when a node completes
- graph emits `rag-node` with phase `error` when a node fails
- graph emits `rag-sources` when `observation.sources` exists

This means:

- node business output belongs in `state`
- node display/debug output belongs in `observation`
- transport conversion belongs in the pipeline

## Builder Selection

Prefer shared builders from `rag-node-observation.ts`.

### Use `createObservation(...)`

Use it when the node does not match a more specific helper and you still need standard timing and output structure.

### Use `createModelCallObservation(...)`

Use it for nodes that call a model, including:

- rewrite-like task model calls
- embedding
- rerank
- generation

### Use `createRetrievalObservation(...)`

Use it for nodes whose primary job is retrieval or candidate selection.

### Use environment helpers

Use shared helpers such as:

- `createModelEnvironment(...)`
- `createTimedEnvironment(...)`
- `createTiming(...)`
- `withTiming(...)`

Review standard:

- prefer the highest-level builder that correctly expresses the node
- only drop to lower-level builders when the existing abstraction genuinely does not fit

## Recommended `runNode(...)` Pattern

Use this shape as the default implementation pattern:

```ts
async runNode(input: SomeNodeInput): Promise<RagNodeResult<SomeNodeStatePatch>> {
  return withTiming(async ({ timing }) => {
    const result = await this.doWork(input);

    return {
      state: {
        // business state patch only
      },
      observation: createObservation({
        label: "...",
        summary: "...",
        details: {
          // structured debug data
        },
        environment: createTimedEnvironment(timing, {
          context: {
            // optional supplemental context
          },
        }),
      }),
    };
  });
}
```

Implementation rules:

- keep business work and observation assembly in the same node
- keep `state` focused on graph data, not UI metadata
- keep `details` structured and machine-readable
- keep `summary` concise and human-readable

## New Node Checklist

When adding a node:

1. Add the node service under `server/src/services/rag-nodes/`.
2. Implement `runNode(...)` returning `RagNodeResult<TStatePatch>`.
3. Reuse shared observation builders.
4. Ensure `environment.timing` is always present.
5. Include `environment.model` for model-calling nodes.
6. Include `environment.retrieval` for retrieval-oriented nodes.
7. Decide whether the node should publish `sources`.
8. Wire the node into `server/src/services/rag-graph.ts`.
9. Keep `server/src/services/rag-pipeline.ts` free of node-specific copy or hardcoded UI assumptions.
10. Update `docs/rag-langgraph-flow.md` if the runtime flow changed.
11. Update this document if the node contract or builder guidance changed.

## Review Rejection Criteria

The following are strong review smells and should usually be rejected:

- node observability assembled in `rag-pipeline.ts`
- frontend relying on a hardcoded ordered list of node cards to understand execution
- nodes returning raw business state with no `observation`
- model nodes omitting model metadata or timing metadata
- model nodes omitting protocol, endpoint, or request metadata that the runtime can already resolve
- retrieval nodes omitting retrieval metadata
- repeated manual construction of the same `environment` structure across multiple nodes
- graph inventing node summaries that should have come from the node itself
- adding one-off event payload formats that bypass `rag-node` or `rag-sources`

## Relationship To Flow Doc

Use the two docs this way:

- `docs/rag-langgraph-flow.md` explains how the current runtime behaves end to end
- `docs/architecture/rag-node-development.md` explains how to implement and review nodes within that architecture

If they diverge, update both so the runtime description and development contract stay aligned.
