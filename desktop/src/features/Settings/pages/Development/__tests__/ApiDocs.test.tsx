// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DevelopmentApiDocs from "../pages/ApiDocs/index";

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getApiBaseUrl: () => "http://127.0.0.1:8787",
}));

describe("DevelopmentApiDocs", () => {
  it("uses the runtime backend origin for the swagger iframe", () => {
    render(<DevelopmentApiDocs />);

    expect(screen.getByTitle("API Docs")).toHaveAttribute(
      "src",
      "http://127.0.0.1:8787/api-docs",
    );
  });
});
