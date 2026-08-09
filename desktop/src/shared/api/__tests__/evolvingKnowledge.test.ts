import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
}));

import { del, get, post } from "@/shared/lib/request";
import {
  compileTopicForConcept,
  createCapture,
  deleteCapture,
  dismissInsight,
  getCapture,
  getCaptureEvidence,
  getCaptureRelations,
  getKnowledgeHealth,
  getStats,
  listCaptures,
  listConcepts,
  listInsights,
  listKnowledgeQueryLogs,
  listTags,
  listTopics,
  listViewpoints,
  listViewpointVersions,
  mergeConcepts,
  queryKnowledge,
  rebuildKnowledge,
  reviewViewpoint,
  searchCaptures,
  writeBackKnowledge,
} from "../evolvingKnowledge";

describe("evolving knowledge api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates, lists, searches, reads, and deletes captures with encoded routes", async () => {
    const input = {
      sourceUrl: "https://example.com/article",
      title: "Article",
      contentType: "webpage" as const,
      rawContent: "content",
    };

    await createCapture(input);
    await listCaptures({ limit: 50, offset: 10, contentType: "web page" });
    await searchCaptures("Mira + RAG");
    await getCapture("capture/1");
    await getCaptureRelations("capture-1");
    await getCaptureEvidence("capture-1");
    await deleteCapture("capture-1");

    expect(post).toHaveBeenCalledWith(
      "/microapps/evolving-knowledge/captures",
      input,
    );
    expect(get).toHaveBeenNthCalledWith(
      1,
      "/microapps/evolving-knowledge/captures?limit=50&offset=10&contentType=web+page",
    );
    expect(get).toHaveBeenNthCalledWith(
      2,
      "/microapps/evolving-knowledge/captures/search?q=Mira%20%2B%20RAG",
    );
    expect(get).toHaveBeenNthCalledWith(
      3,
      "/microapps/evolving-knowledge/captures/capture/1",
    );
    expect(get).toHaveBeenNthCalledWith(
      4,
      "/microapps/evolving-knowledge/captures/capture-1/relations",
    );
    expect(get).toHaveBeenNthCalledWith(
      5,
      "/microapps/evolving-knowledge/captures/capture-1/evidence",
    );
    expect(del).toHaveBeenCalledWith(
      "/microapps/evolving-knowledge/captures/capture-1",
    );
  });

  it("forwards query and writeback contracts without reshaping them", async () => {
    const query = { query: "What changed?", mode: "mixed" as const, limit: 8 };
    const writeback = {
      kind: "viewpoint" as const,
      title: "Current position",
      content: "Evidence-backed statement",
      captureIds: ["capture-1"],
      stance: "supports" as const,
    };

    await queryKnowledge(query);
    await writeBackKnowledge(writeback);

    expect(post).toHaveBeenNthCalledWith(
      1,
      "/microapps/evolving-knowledge/query",
      query,
    );
    expect(post).toHaveBeenNthCalledWith(
      2,
      "/microapps/evolving-knowledge/writeback",
      writeback,
    );
  });

  it("covers insight, health, stats, tags, and query-log routes", async () => {
    await getKnowledgeHealth();
    await listKnowledgeQueryLogs(25);
    await listKnowledgeQueryLogs();
    await listInsights();
    await dismissInsight("insight-1");
    await listTags();
    await getStats();

    expect(vi.mocked(get).mock.calls.map(([route]) => route)).toEqual([
      "/microapps/evolving-knowledge/health",
      "/microapps/evolving-knowledge/query-logs?limit=25",
      "/microapps/evolving-knowledge/query-logs",
      "/microapps/evolving-knowledge/insights",
      "/microapps/evolving-knowledge/tags",
      "/microapps/evolving-knowledge/stats",
    ]);
    expect(post).toHaveBeenCalledWith(
      "/microapps/evolving-knowledge/insights/insight-1/dismiss",
    );
  });

  it("covers concepts, topics, viewpoints, review, and rebuild contracts", async () => {
    await listConcepts({ status: "active", limit: 20 });
    await mergeConcepts("source-1", "target-1");
    await listTopics(12);
    await compileTopicForConcept("concept-1");
    await listViewpoints("topic/1");
    await listViewpoints();
    await listViewpointVersions("viewpoint-1");
    await reviewViewpoint("viewpoint-1", {
      decision: "confirm",
      statement: "Confirmed statement",
    });
    await rebuildKnowledge({ limit: 25, offset: 50 });

    expect(vi.mocked(get).mock.calls.map(([route]) => route)).toEqual([
      "/microapps/evolving-knowledge/concepts?status=active&limit=20",
      "/microapps/evolving-knowledge/topics?limit=12",
      "/microapps/evolving-knowledge/viewpoints?topicId=topic%2F1",
      "/microapps/evolving-knowledge/viewpoints",
      "/microapps/evolving-knowledge/viewpoints/viewpoint-1/versions",
    ]);
    expect(vi.mocked(post).mock.calls).toEqual([
      ["/microapps/evolving-knowledge/concepts/source-1/merge", {
        targetConceptId: "target-1",
      }],
      ["/microapps/evolving-knowledge/topics/compile", {
        conceptId: "concept-1",
      }],
      ["/microapps/evolving-knowledge/viewpoints/viewpoint-1/review", {
        decision: "confirm",
        statement: "Confirmed statement",
      }],
      ["/microapps/evolving-knowledge/rebuild", { limit: 25, offset: 50 }],
    ]);
  });
});
