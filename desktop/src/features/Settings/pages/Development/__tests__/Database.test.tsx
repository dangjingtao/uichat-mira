// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DevelopmentDatabasePage from "../pages/Database/index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getRuntimeDisplayLabel: () => "Desktop",
}));

vi.mock("@/features/system/hooks/useRuntimeHealth", () => ({
  useRuntimeHealth: () => ({
    runtime: { kind: "desktop", backendUrl: "http://127.0.0.1:8787" },
    backendState: { status: "running", detail: "backend ok" },
    databaseState: { status: "running", detail: "sqlite ok" },
    vectorState: { status: "stopped", detail: "sqlite-vec missing" },
  }),
}));

describe("DevelopmentDatabasePage", () => {
  it("renders backend, sqlite, and vector runtime cards", () => {
    render(<DevelopmentDatabasePage />);

    expect(
      screen.getByText("settings.general.health.services.server"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("settings.general.health.services.sqlite"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("settings.general.health.services.sqliteVec"),
    ).toBeInTheDocument();
    expect(screen.getByText("backend ok")).toBeInTheDocument();
    expect(screen.getByText("sqlite ok")).toBeInTheDocument();
    expect(screen.getByText("sqlite-vec missing")).toBeInTheDocument();
  });
});
