// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "../ErrorBoundary";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const ThrowError = ({
  shouldThrow,
  onRender,
}: {
  shouldThrow: boolean;
  onRender?: () => void;
}) => {
  if (onRender) {
    onRender();
  }
  if (shouldThrow) {
    throw new Error("Boom");
  }
  return <span data-testid="child">OK</span>;
};

describe("ErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders fallback when child throws", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>,
    );
    expect(
      screen.getByRole("heading", { name: "ui.errorBoundary.title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Boom ui.errorBoundary.retryOrReload/),
    ).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("retries and recovers when child stops throwing", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>,
    );

    rerender(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "ui.errorBoundary.retry" }),
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("renders reload button", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow />
      </ErrorBoundary>,
    );
    expect(
      screen.getByRole("button", { name: "ui.errorBoundary.reload" }),
    ).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
