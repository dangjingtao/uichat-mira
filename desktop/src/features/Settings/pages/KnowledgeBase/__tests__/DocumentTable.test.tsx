// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import DocumentTable from "../components/DocumentTable";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const documents = [
  {
    id: "d1",
    name: "intro.md",
    type: "md",
    updatedAt: new Date().toISOString(),
    availability: "enabled" as const,
    syncState: "ready" as const,
    enabled: true,
    charCount: 100,
    hits: 5,
    uploadedAt: new Date().toISOString(),
  },
  {
    id: "d2",
    name: "guide.txt",
    type: "txt",
    updatedAt: new Date().toISOString(),
    availability: "disabled" as const,
    syncState: "ready" as const,
    enabled: false,
    charCount: 200,
    hits: 0,
    uploadedAt: new Date().toISOString(),
  },
];

const defaultProps = {
  data: documents,
  selectedRowIds: [] as string[],
  onSelectedRowIdsChange: vi.fn(),
  sortBy: "updatedAt" as const,
  sortOrder: "desc" as const,
  onToggleSort: vi.fn(),
  togglingDocumentIds: [] as string[],
  openActionMenuId: null as string | null,
  onOpenActionMenuChange: vi.fn(),
  onToggleDocumentEnabled: vi.fn(),
  onRebuildIndex: vi.fn(),
  onDeleteDocument: vi.fn(),
  onGoToDetail: vi.fn(),
  emptyState: "No documents",
  selectedKnowledgeBaseId: "kb1",
  tableScrollRef: createRef<HTMLDivElement>(),
};

describe("DocumentTable", () => {
  it("renders document rows", () => {
    render(<DocumentTable {...defaultProps} />);

    expect(screen.getByText("intro.md")).toBeInTheDocument();
    expect(screen.getByText("guide.txt")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(<DocumentTable {...defaultProps} data={[]} />);

    expect(screen.getByText("No documents")).toBeInTheDocument();
  });

  it("calls onToggleSort when header clicked", async () => {
    const user = userEvent.setup();
    const onToggleSort = vi.fn();

    render(<DocumentTable {...defaultProps} onToggleSort={onToggleSort} />);

    await user.click(screen.getByText("settings.knowledgeBase.table.name"));

    expect(onToggleSort).toHaveBeenCalledWith("name");
  });

  it("calls onGoToDetail on row double click", async () => {
    const user = userEvent.setup();
    const onGoToDetail = vi.fn();

    render(<DocumentTable {...defaultProps} onGoToDetail={onGoToDetail} />);

    await user.dblClick(screen.getByText("intro.md"));

    expect(onGoToDetail).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d1" }),
    );
  });

  it("calls onToggleDocumentEnabled when switch clicked", async () => {
    const user = userEvent.setup();
    const onToggleDocumentEnabled = vi.fn();

    render(
      <DocumentTable
        {...defaultProps}
        onToggleDocumentEnabled={onToggleDocumentEnabled}
      />,
    );

    const switches = screen.getAllByRole("switch");
    await user.click(switches[0]);

    expect(onToggleDocumentEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d1" }),
    );
  });

  it("opens action menu and calls onRebuildIndex", async () => {
    const user = userEvent.setup();
    const onRebuildIndex = vi.fn();
    const onOpenActionMenuChange = vi.fn();

    const { rerender } = render(
      <DocumentTable
        {...defaultProps}
        onRebuildIndex={onRebuildIndex}
        onOpenActionMenuChange={onOpenActionMenuChange}
      />,
    );

    const menuButtons = screen.getAllByLabelText(
      /settings\.knowledgeBase\.filters\.moreActionsAria/,
    );
    await user.click(menuButtons[0]);

    expect(onOpenActionMenuChange).toHaveBeenCalledWith("d1");

    rerender(
      <DocumentTable
        {...defaultProps}
        onRebuildIndex={onRebuildIndex}
        onOpenActionMenuChange={onOpenActionMenuChange}
        openActionMenuId="d1"
      />,
    );

    const rebuildButtons = screen.getAllByText(
      "settings.knowledgeBase.actions.rebuildIndex",
    );
    await user.click(rebuildButtons[0]);

    expect(onRebuildIndex).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d1" }),
    );
  });

  it("calls onDeleteDocument from action menu", async () => {
    const user = userEvent.setup();
    const onDeleteDocument = vi.fn();

    render(
      <DocumentTable
        {...defaultProps}
        onDeleteDocument={onDeleteDocument}
        openActionMenuId="d1"
      />,
    );

    const deleteButtons = screen.getAllByText("common.actions.delete");
    await user.click(deleteButtons[0]);

    expect(onDeleteDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: "d1" }),
    );
  });

  it("disables switch while toggling", () => {
    render(<DocumentTable {...defaultProps} togglingDocumentIds={["d1"]} />);

    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toBeDisabled();
  });
});
