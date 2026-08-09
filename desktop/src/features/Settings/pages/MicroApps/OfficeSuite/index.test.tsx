// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OfficeSuitePage from "./index";

const api = vi.hoisted(() => ({
  createExcelVerificationCopy: vi.fn(),
  createOfficeSample: vi.fn(),
  createWordReviewCopy: vi.fn(),
  createWordVerificationCopy: vi.fn(),
  inspectOfficeFile: vi.fn(),
}));
const messages = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/shared/api/officeSuite", () => api);
vi.mock("@/shared/ui/Message", () => ({ message: messages }));
vi.mock("../components/MicroAppPageLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("./components/SkillRuntimePanel", () => ({
  default: () => <div data-testid="skill-runtime">Skill runtime</div>,
}));

function inspectionButton(container: HTMLElement) {
  const input = container.querySelector("input[type='file']") as HTMLInputElement;
  const section = input.closest(".space-y-4") as HTMLElement;
  return Array.from(section.querySelectorAll("button")).find(
    (button) => !button.querySelector("svg"),
  ) as HTMLButtonElement;
}

describe("OfficeSuitePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:office"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  it("creates and downloads a Word test artifact", async () => {
    api.createOfficeSample.mockResolvedValue({
      kind: "word",
      fileName: "sample.docx",
      blob: new Blob(["word"]),
    });
    const user = userEvent.setup();
    render(<OfficeSuitePage />);

    expect(screen.getByTestId("skill-runtime")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Word/ }));

    await waitFor(() => expect(api.createOfficeSample).toHaveBeenCalledWith("word"));
    expect(await screen.findByText("sample.docx")).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(messages.success).toHaveBeenCalled();
  });

  it("rejects unsupported uploads and inspects a supported document", async () => {
    api.inspectOfficeFile.mockResolvedValue({
      kind: "word",
      fileName: "brief.docx",
      extension: ".docx",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      byteSize: 4,
      summary: "One paragraph",
      previewText: "Current document truth",
      structure: { paragraphs: 1 },
    });
    const user = userEvent.setup();
    const { container } = render(<OfficeSuitePage />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(["text"], "notes.txt")] },
    });
    expect(messages.warning).toHaveBeenCalled();
    expect(api.inspectOfficeFile).not.toHaveBeenCalled();

    const file = new File(["docx"], "brief.docx");
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText("brief.docx")).toBeInTheDocument();
    await user.click(inspectionButton(container));

    await waitFor(() => expect(api.inspectOfficeFile).toHaveBeenCalledWith(file));
    expect(await screen.findByText("One paragraph")).toBeInTheDocument();
    expect(screen.getByText("Current document truth")).toBeInTheDocument();
    expect(screen.getByText(/"paragraphs": 1/)).toBeInTheDocument();
  });

  it("builds a Word review request from the current review form", async () => {
    api.createWordReviewCopy.mockResolvedValue({
      kind: "word",
      fileName: "reviewed.docx",
      blob: new Blob(["review"]),
    });
    const user = userEvent.setup();
    const { container } = render(<OfficeSuitePage />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["docx"], "contract.docx");
    await user.upload(input, file);

    const textboxes = screen.getAllByRole("textbox");
    await user.type(textboxes[0], "Original clause");
    await user.type(textboxes[1], "Needs evidence");
    await user.type(textboxes[2], "Replacement clause");
    const wordButtons = screen.getAllByRole("button", { name: /Word/ });
    await user.click(wordButtons.at(-1) as HTMLButtonElement);

    await waitFor(() =>
      expect(api.createWordReviewCopy).toHaveBeenCalledWith(file, {
        author: "Mira",
        comment: { targetText: "Original clause", text: "Needs evidence" },
        insertion: {
          afterText: "Original clause",
          text: "Replacement clause",
        },
        deletion: { targetText: "Original clause" },
      }),
    );
    expect(await screen.findByText("reviewed.docx")).toBeInTheDocument();
  });
});
