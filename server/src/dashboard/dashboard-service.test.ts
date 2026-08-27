import { describe, expect, it } from "vitest";
import { getDashboardOverview } from "./dashboard-service.js";

describe("dashboard service", () => {
  it("aggregates only the three live dashboard widgets", async () => {
    const now = new Date("2026-07-27T08:00:00.000Z");
    const overview = await getDashboardOverview(now);

    expect(overview.generatedAt).toBe(now.toISOString());
    expect(overview.widgets.map((widget) => widget.type)).toEqual([
      "clock-weather",
      "news",
      "mail",
    ]);
    expect(overview.widgets.every((widget) => widget.updatedAt === now.toISOString())).toBe(true);
    expect((overview.widgets[0].data as { demo: boolean }).demo).toBe(false);
    expect((overview.widgets[0].data as { status: string }).status).toBe("loading");
    expect((overview.widgets[1].data as { demo: boolean }).demo).toBe(false);
    expect((overview.widgets[2].data as { demo: boolean }).demo).toBe(false);
    expect((overview.widgets[2].data as { status: string }).status).toBe("loading");
  });
});
