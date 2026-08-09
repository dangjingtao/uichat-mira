import { describe, expect, it } from "vitest";
import {
  decodeChunkingConfigSeparators,
  normalizeChunkingConfig,
  overlapChunkPreviewText,
  splitDocumentText,
} from "./knowledge-base.splitter.js";

describe("knowledge base splitter", () => {
  it("clamps invalid chunk sizes and normalizes separators", () => {
    const config = normalizeChunkingConfig({
      splitterType: "unknown" as never,
      chunkSize: 20,
      chunkOverlap: 1000,
      separators: ["\\n\\n", "\\t"],
    });

    expect(config.splitterType).toBe("recursive");
    expect(config.chunkSize).toBe(100);
    expect(config.chunkOverlap).toBe(99);
    expect(config.separators).toEqual(["\n\n", "\t"]);
    expect(decodeChunkingConfigSeparators("a\\nb\\tc")).toBe("a\nb\tc");
  });

  it("returns zeroed statistics for empty normalized text", async () => {
    const result = await splitDocumentText("  \r\n  ", { replaceWhitespace: true });
    expect(result.normalizedText).toBe("");
    expect(result.chunks).toEqual([]);
    expect(result.stats).toEqual({
      totalChunks: 0,
      minChunkLength: 0,
      maxChunkLength: 0,
      averageChunkLength: 0,
      normalizedTextLength: 0,
    });
  });

  it("removes URLs and emails while preserving deterministic offsets", async () => {
    const result = await splitDocumentText(
      "Intro   https://example.com\r\nContact a@example.com\r\nFinal text",
      { splitterType: "character", chunkSize: 100, chunkOverlap: 0, separator: "\\n", removeUrls: true, replaceWhitespace: true },
    );

    expect(result.normalizedText).not.toContain("example.com");
    expect(result.chunks.map((chunk) => chunk.content)).toEqual(["Intro\nContact\nFinal text"]);
    expect(result.chunks[0]).toMatchObject({ chunkIndex: 1, startOffset: 0, endOffset: result.normalizedText.length });
  });

  it("keeps question and answer blocks separate when QA splitting is enabled", async () => {
    const result = await splitDocumentText(
      "Q: First?\nA: One.\n\n问：第二个？\n答：二。",
      { splitterType: "character", chunkSize: 100, chunkOverlap: 0, separator: "\\n\\n", useQaSplit: true },
    );
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0]?.content).toContain("Q: First?");
    expect(result.chunks[1]?.content).toContain("问：第二个？");
  });

  it("chooses a readable overlap suffix", () => {
    expect(overlapChunkPreviewText("alpha beta gamma", 10)).toBe("gamma");
    expect(overlapChunkPreviewText("short", 10)).toBe("short");
    expect(overlapChunkPreviewText("anything", 0)).toBe("anything");
  });
});
