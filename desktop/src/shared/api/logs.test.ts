// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { readSseFrames, streamRuntimeLogs } from "./logs";

describe("runtime log stream api", () => {
  it("parses complete SSE frames and keeps the trailing partial frame", () => {
    const result = readSseFrames(
      'data: {"type":"snapshot"}\n\ndata: {"type":"append"}',
    );

    expect(result.frames).toEqual(['{"type":"snapshot"}']);
    expect(result.rest).toBe('data: {"type":"append"}');
  });

  it("streams runtime log events from fetch SSE responses", async () => {
    const reader = {
      read: vi
        .fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            'data: {"type":"snapshot","entries":["a"]}\n\n',
          ),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode(
            'data: {"type":"append","entry":"b"}\n\n',
          ),
        })
        .mockResolvedValueOnce({
          done: true,
          value: undefined,
        }),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => reader,
        },
      }),
    );

    const seen: Array<{ type: string }> = [];
    await streamRuntimeLogs({}, async (event) => {
      seen.push(event);
    });

    expect(seen).toEqual([
      { type: "snapshot", entries: ["a"] },
      { type: "append", entry: "b" },
    ]);
  });
});
