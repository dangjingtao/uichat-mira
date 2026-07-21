// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EvaluationCenter from "../Center";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/shared/i18n", () => ({
  getAppLanguage: () => "zh-CN",
}));

vi.mock("@/shared/api/evaluation", () => ({
  getEvaluationRuns: vi.fn(async () => []),
  deleteEvaluationRun: vi.fn(async () => ({ id: "", deleted: true })),
  deleteEvaluationRuns: vi.fn(async () => ({ deletedIds: [] })),
}));

vi.mock("@/shared/api/knowledgeBase", () => ({
  listKnowledgeBases: vi.fn(async () => []),
}));

vi.mock("@/shared/ui/Message", () => ({
  message: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/shared/ui/Modal", () => ({
  Modal: {
    confirm: vi.fn(),
    show: vi.fn(),
    close: vi.fn(),
  },
}));

vi.mock("@/features/Settings/components/SettingsPageLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock("@/features/Settings/components/Evaluation/StatusBadge", () => ({
  default: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("@/features/Settings/components/Evaluation/DetailDrawer", () => ({
  default: () => <div data-testid="detail-drawer">DetailDrawer</div>,
}));

vi.mock("../exportMarkdown", () => ({
  downloadEvaluationRunMarkdown: vi.fn(async () => undefined),
}));

describe("EvaluationCenter", () => {
  it("renders empty state when no runs exist", async () => {
    render(<EvaluationCenter />);

    await waitFor(() => {
      expect(
        screen.getByText("settings.evaluation.center.empty"),
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});
