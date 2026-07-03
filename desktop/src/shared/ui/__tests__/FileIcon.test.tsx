// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileIcon } from "../FileIcon";

describe("FileIcon", () => {
  it("renders PDF icon", () => {
    const { container } = render(<FileIcon extension="pdf" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("text-rose-500");
  });

  it("renders XLSX icon", () => {
    const { container } = render(<FileIcon extension="xlsx" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("text-emerald-500");
  });

  it("renders XLS icon", () => {
    const { container } = render(<FileIcon extension="xls" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("text-emerald-500");
  });

  it("renders default code icon for unknown extensions", () => {
    const { container } = render(<FileIcon extension="txt" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("text-sky-500");
  });

  it("is case-insensitive", () => {
    const { container } = render(<FileIcon extension="PDF" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("text-rose-500");
  });

  it("applies custom className", () => {
    const { container } = render(
      <FileIcon extension="pdf" className="h-8 w-8" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-8");
    expect(svg).toHaveClass("w-8");
  });
});
