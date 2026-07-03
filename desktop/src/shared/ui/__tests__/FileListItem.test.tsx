// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FileListItem } from "../FileListItem";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("FileListItem", () => {
  it("renders file name and extension", () => {
    render(<FileListItem name="report.pdf" extension="pdf" size={1024} />);
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("pdf · 1 KB")).toBeInTheDocument();
  });

  it("formats file size", () => {
    render(<FileListItem name="file" extension="txt" size={2048} />);
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
  });

  it("handles zero bytes", () => {
    render(<FileListItem name="empty" extension="txt" size={0} />);
    expect(screen.getByText(/0 B/)).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    render(
      <FileListItem
        name="report.pdf"
        extension="pdf"
        size={1024}
        onClick={handleClick}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /report\.pdf/ }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("disables the file button when onClick is absent", () => {
    render(<FileListItem name="report.pdf" extension="pdf" size={1024} />);
    expect(screen.getByRole("button", { name: /report\.pdf/ })).toBeDisabled();
  });

  it("renders remove button and calls onRemove", async () => {
    const handleRemove = vi.fn();
    render(
      <FileListItem
        name="report.pdf"
        extension="pdf"
        size={1024}
        onRemove={handleRemove}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "ui.fileListItem.removeFile" }),
    );
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it("applies active style", () => {
    const { container } = render(
      <FileListItem name="report.pdf" extension="pdf" size={1024} active />,
    );
    expect(container.firstChild).toHaveClass("border-primary");
    expect(container.firstChild).toHaveClass("bg-primary/5");
  });
});
