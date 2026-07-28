import { describe, expect, it } from "vitest";
import { getDashboardOverview } from "./dashboard-service.js";

describe("dashboard service", () => {
  it("aggregates the six read-only demo widgets behind one DTO", async () => {
    const now = new Date("2026-07-27T08:00:00.000Z");
    const overview = await getDashboardOverview(now);

    expect(overview.generatedAt).toBe(now.toISOString());
    expect(overview.widgets.map((widget) => widget.type)).toEqual([
      "clock-weather",
      "news",
      "mail",
      "project-status",
      "countdown",
      "recent-artifacts",
    ]);
    expect(overview.widgets.every((widget) => widget.updatedAt === now.toISOString())).toBe(true);
    expect(overview.widgets.filter((widget) => !["clock-weather", "news"].includes(widget.type)).every((widget) => (widget.data as { demo: boolean }).demo)).toBe(true);
    expect((overview.widgets[0].data as { demo: boolean }).demo).toBe(false);
    expect((overview.widgets[0].data as { status: string }).status).toBe("loading");
    expect((overview.widgets[1].data as { demo: boolean }).demo).toBe(false);
  });
});
