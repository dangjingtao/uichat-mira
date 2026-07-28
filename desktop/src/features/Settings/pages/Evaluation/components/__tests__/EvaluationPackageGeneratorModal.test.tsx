// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EvaluationPackageGeneratorModal from "../EvaluationPackageGeneratorModal";

const { listKnowledgeBases, listKnowledgeBaseDocuments, generateEvaluationPackage } =
  vi.hoisted(() => ({
    listKnowledgeBases: vi.fn(),
    listKnowledgeBaseDocuments: vi.fn(),
    generateEvaluationPackage: vi.fn(),
  }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}));

vi.mock("@/app/providers/RoleModelConfigProvider", () => ({
  useRoleModelConfigs: () => ({
    configMap: {
      evaluation: {
        providerCode: "openai",
        providerConnectionId: "openai-default",
        remoteModelId: "gpt-4o-mini",
        name: "评测模型",
      },
    },
  }),
}));

vi.mock("@/shared/api/knowledgeBase", () => ({
  listKnowledgeBases,
  listKnowledgeBaseDocuments,
}));

vi.mock("@/shared/api/evaluation", () => ({
  generateEvaluationPackage,
}));

vi.mock("@/shared/ui/Message", () => ({
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

describe("EvaluationPackageGeneratorModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads resources, applies a preset, and submits the package form", async () => {
    listKnowledgeBases.mockResolvedValue([{ id: "kb-1", name: "产品知识库" }]);
    listKnowledgeBaseDocuments.mockResolvedValue([
      { chunkCount: 6 },
      { chunkCount: 4 },
    ]);
    generateEvaluationPackage.mockResolvedValue({
      fileName: "evaluation.zip",
      blob: new Blob(["zip"]),
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:package");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<EvaluationPackageGeneratorModal onClose={onClose} />);

    expect(await screen.findByText("产品知识库")).toBeInTheDocument();
    await waitFor(() => expect(listKnowledgeBaseDocuments).toHaveBeenCalledWith("kb-1", {
      enabled: true,
      indexStatus: "ready",
    }));

    const preset = screen.getAllByRole("combobox")[0];
    await user.click(preset);
    await user.click(await screen.findByRole("option", { name: "settings.evaluation.packageGenerator.presets.strict.label" }));
    expect(screen.getByLabelText("TopK")).toHaveValue(15);

    await user.click(screen.getByRole("button", { name: "settings.evaluation.packageGenerator.generateAndDownload" }));
    await waitFor(() => expect(generateEvaluationPackage).toHaveBeenCalledWith(expect.objectContaining({
      knowledgeBaseId: "kb-1",
      topK: 15,
      documentCount: 2,
      sampleCount: 10,
    })));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:package");
  });

  it("allows cancelling before generation", async () => {
    listKnowledgeBases.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<EvaluationPackageGeneratorModal onClose={onClose} />);

    fireEvent.click(await screen.findByRole("button", { name: "common.actions.cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(generateEvaluationPackage).not.toHaveBeenCalled();
  });
});
