// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CoverageReportView from "../components/CoverageReportView";

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getDesktopRuntime: () => ({ backendUrl: "http://127.0.0.1:8787" }),
  getApiBaseUrl: () => "http://127.0.0.1:8787",
  isDesktopShell: () => true,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("CoverageReportView", () => {
  it("requests client coverage summary", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("Not Found", { status: 404 }),
    );

    render(<CoverageReportView type="client" />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:8787/client-coverage/coverage-summary.json",
      );
    });
  });

  it("requests server coverage summary", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("Not Found", { status: 404 }),
    );

    render(<CoverageReportView type="server" />);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "http://127.0.0.1:8787/server-coverage/coverage-summary.json",
      );
    });
  });
});
