// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import EvaluationPackageGeneratorModal from "../EvaluationPackageGeneratorModal";

const {
  generateEvaluationPackage,
  listKnowledgeBaseDocuments,
  listKnowledgeBases,
} = vi.hoisted(() => ({
  generateEvaluationPackage: vi.fn(),
  listKnowledgeBaseDocuments: vi.fn(),
  listKnowledgeBases: vi.fn(),
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
        name: "Evaluation model",
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

describe("current EvaluationPackageGeneratorModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads current resources, applies a preset, and generates a package", async () => {
    listKnowledgeBases.mockResolvedValue([
      { id: "kb-1", name: "Product knowledge" },
    ]);
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

    expect(await screen.findByText("Product knowledge")).toBeInTheDocument();
    await waitFor(() =>
      expect(listKnowledgeBaseDocuments).toHaveBeenCalledWith("kb-1", {
        enabled: true,
        indexStatus: "ready",
      }),
    );

    await user.click(screen.getAllByRole("combobox")[0]);
    await user.click(
      await screen.findByRole("option", {
        name: "settings.evaluation.packageGenerator.presets.strict.label",
      }),
    );
    expect(screen.getByLabelText("TopK")).toHaveValue(15);

    await user.click(
      screen.getByRole("button", {
        name: "settings.evaluation.packageGenerator.generateAndDownload",
      }),
    );
    await waitFor(() =>
      expect(generateEvaluationPackage).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledgeBaseId: "kb-1",
          topK: 15,
          documentCount: 2,
          sampleCount: 10,
        }),
      ),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:package");
  });

  it("cancels without generating a package", async () => {
    listKnowledgeBases.mockResolvedValue([]);
    const onClose = vi.fn();
    render(<EvaluationPackageGeneratorModal onClose={onClose} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "common.actions.cancel" }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(generateEvaluationPackage).not.toHaveBeenCalled();
  });
});
