import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/shared/uchat/core";
import { resolveDesktopChatArtifactKind } from "./DesktopChatArtifactSlot";
import { readSkillReportArtifactMarker } from "./SkillReportArtifactRenderer";

const message = (text: string): ChatMessage => ({
  id: "message-1",
  threadId: "thread-1",
  role: "assistant",
  parts: [{ type: "text", text }],
  createdAt: "2026-07-26T00:00:00.000Z",
  parentId: null,
  status: "complete",
});

describe("DesktopChatArtifactSlot", () => {
  it("does not reserve an artifact slot for an ordinary message", () => {
    const ordinary = message("普通回复");

    expect(readSkillReportArtifactMarker(ordinary)).toBeNull();
    expect(resolveDesktopChatArtifactKind(ordinary)).toBeNull();
  });

  it("routes a skill report marker through the host artifact registry", () => {
    const report = message(
      "报告已生成。<!--mira-skill-report:session_123:pdf-->",
    );

    expect(readSkillReportArtifactMarker(report)).toEqual({
      sessionId: "session_123",
      pdfAvailable: true,
    });
    expect(resolveDesktopChatArtifactKind(report)).toBe("skill-report");
  });
});
