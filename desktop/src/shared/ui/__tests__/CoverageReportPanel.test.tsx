// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CoverageReportPanel, {
  type CoverageSummary,
} from "../CoverageReportPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function createCoverageSummary(): CoverageSummary {
  return {
    total: {
      lines: { total: 100, covered: 80, skipped: 0, pct: 80 },
      statements: { total: 100, covered: 70, skipped: 0, pct: 70 },
      functions: { total: 100, covered: 60, skipped: 0, pct: 60 },
      branches: { total: 100, covered: 50, skipped: 0, pct: 50 },
    },
    "src/a.ts": {
      lines: { total: 10, covered: 10, skipped: 0, pct: 100 },
      statements: { total: 10, covered: 10, skipped: 0, pct: 100 },
      functions: { total: 10, covered: 10, skipped: 0, pct: 100 },
      branches: { total: 10, covered: 10, skipped: 0, pct: 100 },
    },
    "src/b.ts": {
      lines: { total: 10, covered: 5, skipped: 0, pct: 50 },
      statements: { total: 10, covered: 5, skipped: 0, pct: 50 },
      functions: { total: 10, covered: 5, skipped: 0, pct: 50 },
      branches: { total: 10, covered: 5, skipped: 0, pct: 50 },
    },
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
        json: () =>
          Promise.resolve({
            numTotalTests: 2,
            numPassedTests: 1,
            numFailedTests: 1,
            testResults: [
              {
                name: "src/a.test.ts",
                status: "failed",
                startTime: 1000,
                endTime: 2500,
                assertionResults: [
                  {
                    fullName: "a > passes",
                    title: "passes",
                    status: "passed",
                    duration: 10,
                    failureMessages: [],
                  },
                  {
                    fullName: "a > b",
                    title: "b",
                    status: "failed",
                    duration: 12,
                    failureMessages: ["expected true to be false"],
                  },
                ],
              },
            ],
          }),
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
      expect(screen.getByText("2")).toBeInTheDocument();
    });
    expect(screen.getByText("a > b")).toBeInTheDocument();
    expect(screen.getByText("expected true to be false")).toBeInTheDocument();
  });

  it("sorts entries by clicking headers", async () => {
    vi.stubGlobal("fetch", mockFetch(createCoverageSummary()));
    render(<CoverageReportPanel src="/coverage.json" title="Coverage" />);
    await waitFor(() => {
      expect(screen.getByText("a.ts")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Statements/i }));
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      expect(rows[1]).toHaveTextContent("b.ts");
      expect(rows[2]).toHaveTextContent("a.ts");
    });
  });
});
