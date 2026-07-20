// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileUploadDropzone } from "../FileUploadDropzone";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("FileUploadDropzone", () => {
  it("renders button and helper text", () => {
    render(
      <FileUploadDropzone
        onSelectFiles={() => {}}
        helperText="PDF only"
      />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.queryByText("ui.fileUploadDropzone.dragAndDrop")).not.toBeInTheDocument();
    expect(screen.getByText("ui.fileUploadDropzone.selectFile")).toBeInTheDocument();
    expect(screen.getByText("PDF only")).toBeInTheDocument();
  });

  it("opens file input when clicked", async () => {
    render(<FileUploadDropzone onSelectFiles={() => {}} />);
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    await userEvent.click(screen.getByRole("button"));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("calls onSelectFiles with selected files", () => {
    const handleSelect = vi.fn();
    render(<FileUploadDropzone onSelectFiles={handleSelect} />);
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["content"], "test.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(handleSelect).toHaveBeenCalledTimes(1);
  });

  it("limits files when maxCount is set", () => {
    const handleSelect = vi.fn();
    render(<FileUploadDropzone onSelectFiles={handleSelect} maxCount={2} />);
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const files = [
      new File(["a"], "a.txt", { type: "text/plain" }),
      new File(["b"], "b.txt", { type: "text/plain" }),
      new File(["c"], "c.txt", { type: "text/plain" }),
    ];
    fireEvent.change(input, { target: { files } });
    const received = handleSelect.mock.calls[0][0] as FileList;
    expect(received.length).toBe(2);
  });

  it("does not open file input when disabled", async () => {
    render(<FileUploadDropzone onSelectFiles={() => {}} disabled />);
    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    await userEvent.click(screen.getByRole("button"));
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
