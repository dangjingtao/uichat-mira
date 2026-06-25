// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModalProvider, ModalShell, useModal } from "../Modal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("ModalShell", () => {
  it("renders null when closed", () => {
    const { container } = render(
      <ModalShell open={false} onClose={() => {}}>
        Content
      </ModalShell>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders title and children", () => {
    render(
      <ModalShell open title="Title" onClose={() => {}}>
        <span data-testid="content">Body</span>
      </ModalShell>,
    );
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("calls onClose when mask clicked", async () => {
    const handleClose = vi.fn();
    render(
      <ModalShell open onClose={handleClose}>
        Content
      </ModalShell>,
    );
    const [maskButton] = screen.getAllByLabelText("ui.modal.closeAria");
    await userEvent.click(maskButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when maskClosable is false", async () => {
    const handleClose = vi.fn();
    render(
      <ModalShell open onClose={handleClose} maskClosable={false}>
        Content
      </ModalShell>,
    );
    const [maskButton] = screen.getAllByLabelText("ui.modal.closeAria");
    await userEvent.click(maskButton);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it("calls onClose when Escape pressed", () => {
    const handleClose = vi.fn();
    render(
      <ModalShell open onClose={handleClose}>
        Content
      </ModalShell>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("renders custom footer", () => {
    render(
      <ModalShell
        open
        onClose={() => {}}
        footer={<span data-testid="footer" />}
      >
        Content
      </ModalShell>,
    );
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("hides footer when footer is null", () => {
    render(
      <ModalShell open onClose={() => {}} footer={null}>
        Content
      </ModalShell>,
    );
    expect(document.querySelector("footer")).not.toBeInTheDocument();
  });
});

function TestModal() {
  const modal = useModal();
  return (
    <button
      type="button"
      onClick={() =>
        modal.show({
          title: "Hello",
          content: <span data-testid="modal-body">World</span>,
        })
      }
    >
      Show
    </button>
  );
}

describe("ModalProvider", () => {
  it("shows and closes modal", async () => {
    render(
      <ModalProvider>
        <TestModal />
      </ModalProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByTestId("modal-body")).toBeInTheDocument();

    const closeButtons = screen.getAllByLabelText("ui.modal.closeAria");
    await userEvent.click(closeButtons[closeButtons.length - 1]);
    expect(screen.queryByTestId("modal-body")).not.toBeInTheDocument();
  });
});
