// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImagePreviewOverlay from "../ImagePreviewOverlay";

describe("ImagePreviewOverlay", () => {
  it("returns null when closed", () => {
    const { container } = render(
      <ImagePreviewOverlay src="img.png" open={false} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when src is null", () => {
    const { container } = render(
      <ImagePreviewOverlay src={null} open onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders image when open", () => {
    render(
      <ImagePreviewOverlay src="img.png" open onClose={() => {}} alt="Pic" />,
    );
    const img = screen.getByRole("img", { name: "Pic" });
    expect(img).toHaveAttribute("src", "img.png");
  });

  it("calls onClose when backdrop clicked", () => {
    const handleClose = vi.fn();
    render(<ImagePreviewOverlay src="img.png" open onClose={handleClose} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when image clicked", () => {
    const handleClose = vi.fn();
    render(
      <ImagePreviewOverlay src="img.png" open onClose={handleClose} />,
    );
    fireEvent.click(document.querySelector("img") as HTMLElement);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape pressed", () => {
    const handleClose = vi.fn();
    render(<ImagePreviewOverlay src="img.png" open onClose={handleClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("zooms in on wheel up", () => {
    render(
      <ImagePreviewOverlay
        src="img.png"
        open
        onClose={() => {}}
        alt="Preview"
      />,
    );
    const img = screen.getByRole("img");
    fireEvent.wheel(screen.getByRole("dialog"), { deltaY: -100 });
    expect(img.style.transform).toMatch(/scale\(1\.\d+\)/);
  });

  it("zooms out on wheel down", () => {
    render(
      <ImagePreviewOverlay
        src="img.png"
        open
        onClose={() => {}}
        alt="Preview"
      />,
    );
    const img = screen.getByRole("img");
    fireEvent.wheel(screen.getByRole("dialog"), { deltaY: 100 });
    expect(img.style.transform).toMatch(/scale\(0\.\d+\)/);
  });
});
