// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EvolvingKnowledgeStudioPage from "./index";

const api = vi.hoisted(() => ({
  deleteCapture: vi.fn(),
  dismissInsight: vi.fn(),
  getCapture: vi.fn(),
  getCaptureRelations: vi.fn(),
  getStats: vi.fn(),
  listCaptures: vi.fn(),
  listInsights: vi.fn(),
  rebuildKnowledge: vi.fn(),
  searchCaptures: vi.fn(),
}));
const modal = vi.hoisted(() => ({ confirm: vi.fn() }));
const messages = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock("@/shared/api/evolvingKnowledge", () => api);
vi.mock("@/shared/api/attachments", () => ({
  resolveAttachmentUrl: (value: string) => `/resolved${value}`,
}));
vi.mock("@/shared/ui/Message", () => ({ message: messages }));
vi.mock("../components/MicroAppPageLayout", () => ({
  default: ({
    children,
    slot,
  }: {
    children: React.ReactNode;
    slot?: React.ReactNode;
  }) => (
    <main>
      <header>{slot}</header>
      {children}
    </main>
  ),
}));
vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();
  return {
    Button: actual.Button,
    Drawer: actual.Drawer,
    MarkdownText: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Result: actual.Result,
    Skeleton: actual.Skeleton,
    Modal: modal,
  };
});

const capture = {
  id: "capture-1",
  sourceUrl: "https://example.com/one",
  title: "Capture One",
  favicon: "",
  capturedAt: "2026-08-04T00:00:00.000Z",
  contentType: "webpage",
  rawContent: "Raw ![image](/attachments/image.png)",
  rewrittenSummary: "Summary One",
  aiTags: ["tag-one"],
  aiEntities: [],
  userEdited: false,
  captureMetadata: {},
  createdAt: "2026-08-04T00:00:00.000Z",
  updatedAt: "2026-08-04T00:00:00.000Z",
};
const insight = {
  id: "insight-1",
  insightType: "synthesis",
  title: "Insight One",
  description: "Insight details",
  triggerCaptureId: "capture-1",
  relatedCaptureIdsJson: "[]",
  relatedConceptIdsJson: "[]",
  evidenceUnitIdsJson: "[]",
  dismissedByUser: false,
  confidence: 0.9,
  createdAt: "2026-08-04T00:00:00.000Z",
  expiresAt: null,
};

describe("EvolvingKnowledgeStudioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.listCaptures.mockResolvedValue([capture]);
    api.listInsights.mockResolvedValue([insight]);
    api.getStats.mockResolvedValue({
      totalCaptures: 1,
      totalInsights: 1,
      totalTags: 1,
      byContentType: { webpage: 1 },
      topTags: [{ tagName: "tag-one", usageCount: 1 }],
    });
    api.searchCaptures.mockResolvedValue([]);
    api.getCapture.mockResolvedValue(capture);
    api.getCaptureRelations.mockResolvedValue([
      {
        id: "relation-1",
        sourceCaptureId: "capture-1",
        targetCaptureId: "capture-2",
        relationType: "similar",
        confidence: 0.8,
        aiReasoning: "Related evidence",
      },
    ]);
    api.rebuildKnowledge.mockResolvedValue({
      capturesScanned: 1,
      nextOffset: 1,
      hasMore: false,
    });
  });

  it("loads the current timeline and searches with trimmed input", async () => {
    const user = userEvent.setup();
    render(<EvolvingKnowledgeStudioPage />);

    expect(await screen.findByText("Capture One")).toBeInTheDocument();
    expect(screen.getByText("Insight One")).toBeInTheDocument();
    expect(screen.getByText("Summary One")).toBeInTheDocument();
    expect(api.listCaptures).toHaveBeenCalledWith({ limit: 50 });

    const search = screen.getByRole("textbox");
    await user.type(search, "  current truth  {Enter}");

    await waitFor(() =>
      expect(api.searchCaptures).toHaveBeenCalledWith("current truth"),
    );
  });

  it("loads insight source and capture relations from their current actions", async () => {
    const user = userEvent.setup();
    const { container } = render(<EvolvingKnowledgeStudioPage />);
    await screen.findByText("Capture One");

    await user.click(screen.getByText("Insight One"));
    await waitFor(() => expect(api.getCapture).toHaveBeenCalledWith("capture-1"));
    expect(screen.getAllByText("Insight details").length).toBeGreaterThan(0);

    const relationButton = container
      .querySelector(".lucide-link-2")
      ?.closest("button") as HTMLButtonElement;
    await user.click(relationButton);
    await waitFor(() =>
      expect(api.getCaptureRelations).toHaveBeenCalledWith("capture-1"),
    );
    expect(await screen.findByText("Related evidence")).toBeInTheDocument();
  });

  it("dismisses insights, rebuilds knowledge, and confirms capture deletion", async () => {
    const user = userEvent.setup();
    const { container } = render(<EvolvingKnowledgeStudioPage />);
    await screen.findByText("Capture One");

    const dismissButton = container
      .querySelector(".lucide-x")
      ?.closest("button") as HTMLButtonElement;
    await user.click(dismissButton);
    await waitFor(() => expect(api.dismissInsight).toHaveBeenCalledWith("insight-1"));
    expect(screen.queryByText("Insight One")).not.toBeInTheDocument();

    const rebuildButton = container
      .querySelector(".lucide-refresh-cw")
      ?.closest("button") as HTMLButtonElement;
    await user.click(rebuildButton);
    await waitFor(() =>
      expect(api.rebuildKnowledge).toHaveBeenCalledWith({ limit: 25, offset: 0 }),
    );
    expect(messages.success).toHaveBeenCalled();

    const deleteButton = container
      .querySelector(".lucide-trash-2")
      ?.closest("button") as HTMLButtonElement;
    await user.click(deleteButton);
    expect(modal.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "danger", onConfirm: expect.any(Function) }),
    );
    await act(async () => modal.confirm.mock.calls[0]?.[0].onConfirm());
    expect(api.deleteCapture).toHaveBeenCalledWith("capture-1");
  });
});
