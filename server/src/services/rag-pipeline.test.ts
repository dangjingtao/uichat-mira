import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  retrieve: vi.fn(),
  streamEvents: vi.fn(),
}));

vi.mock("./rag-graph", () => ({ ragGraph: mocks }));

import { ragPipeline } from "./rag-pipeline.js";

const readStream = async (stream: NodeJS.ReadableStream) => {
  let result = "";
  for await (const chunk of stream) result += String(chunk);
  return result;
};

describe("RAG pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the public answer and sources from graph execution", async () => {
    const sources = [{ chunkId: 1, documentId: "d", documentName: "Doc", content: "evidence", score: 0.8 }];
    mocks.run.mockResolvedValue({ answer: "result", sources, internal: "hidden" });
    await expect(ragPipeline.run({ question: "q" })).resolves.toEqual({ answer: "result", sources });
  });

  it("preserves empty retrieval results", async () => {
    mocks.retrieve.mockResolvedValue([]);
    await expect(ragPipeline.retrieveOnly({ question: "missing" })).resolves.toEqual([]);
  });

  it("emits one generated answer when updates follow streamed deltas", async () => {
    mocks.streamEvents.mockResolvedValue((async function* () {
      yield ["custom", { type: "generate-delta", delta: "hel" }];
      yield ["custom", { type: "generate-delta", delta: "lo" }];
      yield ["updates", { generate: { answer: "hello", sources: [] } }];
    })());

    const output = await readStream(ragPipeline.stream({ question: "q" }));
    expect(output.match(/\"delta\":\"hel\"/g)).toHaveLength(1);
    expect(output.match(/\"delta\":\"lo\"/g)).toHaveLength(1);
    expect(output).not.toContain('"delta":"hello"');
    expect(output).toContain('"finishReason":"stop"');
  });

  it("reports graph failures and completes assistant persistence with an error state", async () => {
    mocks.streamEvents.mockRejectedValue(new Error("retrieve failed"));
    const onComplete = vi.fn();
    const output = await readStream(ragPipeline.assistantStream(
      { question: "q" },
      { messageId: "message-1", onComplete },
    ));

    expect(output).toContain("retrieve failed");
    expect(output).toContain('"finishReason":"error"');
    expect(onComplete).toHaveBeenCalledWith({
      messageId: "message-1",
      answer: "",
      sources: [],
      finishReason: "error",
    });
  });
});
