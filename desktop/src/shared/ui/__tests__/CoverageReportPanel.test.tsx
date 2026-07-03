// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CoverageReportPanel, {
  type CoverageReport,
  type TestReport,
} from "../CoverageReportPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function createCoverageSummary(): CoverageReport {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-02T12:00:00.000Z",
    scope: "client",
    summary: {
      total: {
        lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
        statements: { total: 100, covered: 70, skipped: 0, pct: 70 },
        functions: { total: 100, covered: 60, skipped: 0, pct: 60 },
        branches: { total: 100, covered: 50, skipped: 0, pct: 50 },
      },
    },
    files: [
      {
        path: "src/a.ts",
        absolutePath: "D:/workspace/rag-demo/desktop/src/a.ts",
        summary: {
          lines: { total: 10, covered: 10, skipped: 0, pct: 100 },
          statements: { total: 10, covered: 10, skipped: 0, pct: 100 },
          functions: { total: 10, covered: 10, skipped: 0, pct: 100 },
          branches: { total: 10, covered: 10, skipped: 0, pct: 100 },
        },
        lines: { map: { "1": {}, "2": {} }, hits: { "1": 1, "2": 1 } },
        statements: { map: { "1": {}, "2": {} }, hits: { "1": 1, "2": 1 } },
        functions: { map: { "1": {}, "2": {} }, hits: { "1": 1, "2": 1 } },
        branches: [
          {
            id: "b1",
            line: 12,
            type: "if",
            locations: [
              { index: 0, start: {}, end: {}, count: 1 },
              { index: 1, start: {}, end: {}, count: 1 },
            ],
          },
        ],
      },
      {
        path: "src/b.ts",
        absolutePath: "D:/workspace/rag-demo/desktop/src/b.ts",
        summary: {
          lines: { total: 10, covered: 5, skipped: 0, pct: 50 },
          statements: { total: 10, covered: 5, skipped: 0, pct: 50 },
          functions: { total: 10, covered: 5, skipped: 0, pct: 50 },
          branches: { total: 10, covered: 5, skipped: 0, pct: 50 },
        },
        lines: { map: { "10": {}, "11": {}, "12": {} }, hits: { "10": 1, "11": 0, "12": 0 } },
        statements: { map: { "21": {}, "22": {} }, hits: { "21": 1, "22": 0 } },
        functions: { map: { "31": {}, "32": {} }, hits: { "31": 1, "32": 0 } },
        branches: [
          {
            id: "b2",
            line: 24,
            type: "if",
            locations: [
              { index: 0, start: {}, end: {}, count: 1 },
              { index: 1, start: {}, end: {}, count: 0 },
            ],
          },
        ],
      },
    ],
  };
}

function createTestReport(): TestReport {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-02T12:00:00.000Z",
    scope: "client",
    summary: {
      totalTests: 2,
      passedTests: 1,
      failedTests: 1,
      pendingTests: 0,
      todoTests: 0,
      totalSuites: 1,
      passedSuites: 0,
      failedSuites: 1,
      pendingSuites: 0,
      success: false,
      startTime: 1000,
      durationMs: 1500,
    },
    suites: [
      {
        name: "src/a.test.ts",
        absoluteName: "D:/workspace/rag-demo/desktop/src/a.test.ts",
        status: "failed",
        startTime: 1000,
        endTime: 2500,
        message: "",
        assertionResults: [
          {
            ancestorTitles: ["a"],
            fullName: "a > passes",
            title: "passes",
            status: "passed",
            duration: 10,
            failureMessages: [],
          },
          {
            ancestorTitles: ["a"],
            fullName: "a > b",
            title: "b",
            status: "failed",
            duration: 12,
            failureMessages: ["expected true to be false"],
          },
        ],
      },
    ],
  };
}

function mockFetch(response: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(response),
  });
}

describe("CoverageReportPanel", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders loading state initially", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<CoverageReportPanel src="/coverage.json" title="Coverage" />);
    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  it("renders empty state when fetch returns non-ok", async () => {
    vi.stubGlobal("fetch", mockFetch({}, false));
    render(<CoverageReportPanel src="/coverage.json" title="Coverage" />);
    await waitFor(() => {
      expect(screen.getByText("覆盖率报告暂不可用")).toBeInTheDocument();
    });
  });

  it("renders empty state when data lacks total", async () => {
    vi.stubGlobal("fetch", mockFetch({}));
    render(<CoverageReportPanel src="/coverage.json" title="Coverage" />);
    await waitFor(() => {
      expect(screen.getByText("覆盖率报告暂不可用")).toBeInTheDocument();
    });
  });

  it("renders error state when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    render(<CoverageReportPanel src="/coverage.json" title="Coverage" />);
    await waitFor(() => {
      expect(screen.getByText("覆盖率报告加载失败")).toBeInTheDocument();
      expect(screen.getByText("network error")).toBeInTheDocument();
    });
  });

  it("renders coverage summary and file entries", async () => {
    vi.stubGlobal("fetch", mockFetch(createCoverageSummary()));
    render(<CoverageReportPanel src="/coverage.json" title="Coverage" />);
    await waitFor(() => {
      expect(screen.getByText("70.00%")).toBeInTheDocument();
    });
    expect(screen.getByText("a.ts")).toBeInTheDocument();
    expect(screen.getByText("b.ts")).toBeInTheDocument();
    expect(screen.getByText("文件摘要")).toBeInTheDocument();
  });

  it("renders test result summary when resultSrc is provided", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/coverage.json") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createCoverageSummary()),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createTestReport()),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoverageReportPanel
        src="/coverage.json"
        resultSrc="/results.json"
        title="Coverage"
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("settings.development.testResults.total"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("a.test.ts")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /查看/i }).length).toBeGreaterThan(0);
  });

  it("sorts entries by clicking headers", async () => {
    vi.stubGlobal("fetch", mockFetch(createCoverageSummary()));
    render(<CoverageReportPanel src="/coverage.json" title="Coverage" />);
    await waitFor(() => {
      expect(screen.getByText("a.ts")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Statements/i }));
    await userEvent.click(screen.getByRole("button", { name: /Statements/i }));
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveTextContent("b.ts");
      expect(rows[2]).toHaveTextContent("a.ts");
    });
  });

  it("opens file details in a modal", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/coverage.json") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(createCoverageSummary()),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(createTestReport()),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CoverageReportPanel
        src="/coverage.json"
        resultSrc="/results.json"
        title="Coverage"
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /查看/i }).length).toBeGreaterThan(0);
    });

    await userEvent.click(screen.getAllByRole("button", { name: /查看/i })[0]);

    expect(screen.getByText("a > b")).toBeInTheDocument();
    expect(screen.getByText("expected true to be false")).toBeInTheDocument();
    expect(screen.getAllByText("src/a.test.ts").length).toBeGreaterThan(0);
  });

  it("renders useful coverage diagnostics for coverage-only files", async () => {
    vi.stubGlobal("fetch", mockFetch(createCoverageSummary()));
    render(<CoverageReportPanel src="/coverage.json" title="Coverage" />);

    await waitFor(() => {
      expect(screen.getByText("b.ts")).toBeInTheDocument();
    });

    const row = screen.getByText("b.ts").closest("tr");
    expect(row).not.toBeNull();
    await userEvent.click(within(row as HTMLTableRowElement).getByRole("button", { name: /查看/i }));

    expect(screen.getByText("覆盖率明细")).toBeInTheDocument();
    expect(screen.getByText("执行命中概览")).toBeInTheDocument();
    expect(screen.getByText("未覆盖线索")).toBeInTheDocument();
    expect(screen.getByText(/Lines:/)).toBeInTheDocument();
    expect(screen.getByText(/11, 12/)).toBeInTheDocument();
    expect(screen.getByText(/line 24 · if · #1/)).toBeInTheDocument();
  });
});
