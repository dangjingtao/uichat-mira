// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import KnowledgeBaseSettings from "../pages";

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let embeddingConnected = true;

vi.mock("../hooks/useKnowledgeBase", () => ({
  useKnowledgeBase: () => ({
    knowledgeBase: {
      id: "kb1",
      name: "KB One",
      documentCount: 2,
      totalChunkCount: 10,
      isSystem: false,
      metadata: { persona: "", scenario: "", tags: [] },
    },
    knowledgeBases: [{ id: "kb1", name: "KB One", isSystem: false }],
    documents: [],
    selectedDocumentIds: [],
    setSelectedDocumentIds: vi.fn(),
    filter: "all",
    setFilter: vi.fn(),
    searchText: "",
    setSearchText: vi.fn(),
    knowledgeBaseSearchText: "",
    setKnowledgeBaseSearchText: vi.fn(),
    openActionMenuId: null,
    setOpenActionMenuId: vi.fn(),
    sortBy: "updatedAt",
    sortOrder: "desc",
    togglingDocumentIds: [],
    loading: false,
    tableScrollRef: { current: null },
    modelAccessStatus: {
      embeddingConnected,
      llmConnected: true,
      rerankConnected: false,
    },
    selectedKnowledgeBaseId: "kb1",
    visibleDocuments: [],
    selectedDocumentCount: 0,
    canDeleteKnowledgeBase: true,
    filteredKnowledgeBases: [{ id: "kb1", name: "KB One", isSystem: false }],
    knowledgeBaseSelectOptions: [{ value: "kb1", label: "KB One" }],
    refreshAll: vi.fn(),
    handleSelectKnowledgeBase: vi.fn(),
    toggleSort: vi.fn(),
    handleToggleDocumentEnabled: vi.fn(),
    resetDocumentViewState: vi.fn(),
    setSearchParams: vi.fn(),
  }),
}));

vi.mock("@/features/Settings/components/SettingsPageLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

vi.mock("@/features/Settings/components/SettingsNotice", () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="notice">{children}</div>
  ),
}));

vi.mock("../components/KnowledgeBaseSidebar", () => ({
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

vi.mock("../components/KnowledgeBaseToolbar", () => ({
  default: () => <div data-testid="toolbar">Toolbar</div>,
}));

vi.mock("../components/DocumentTable", () => ({
  default: () => <div data-testid="table">DocumentTable</div>,
}));

describe("KnowledgeBaseSettings page", () => {
  beforeEach(() => {
    embeddingConnected = true;
  });

  it("renders layout with sidebar, toolbar and table", () => {
    render(<KnowledgeBaseSettings />);

    expect(screen.getByTestId("layout")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar")).toBeInTheDocument();
    expect(screen.getByTestId("table")).toBeInTheDocument();
  });

  it("shows notice when embedding is disconnected", () => {
    embeddingConnected = false;

    render(<KnowledgeBaseSettings />);

    expect(screen.getByTestId("notice")).toBeInTheDocument();
  });
});
