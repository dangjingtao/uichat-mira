// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { MessageProvider, message, useMessage } from "../Message";

function TestMessage({
  method = "open",
  duration = 0,
}: {
  method?: keyof ReturnType<typeof useMessage>;
  duration?: number;
}) {
  const msg = useMessage();
  return (
    <button
      type="button"
      onClick={() => {
        if (method === "open") {
          msg.open({ content: "Hello", duration });
        } else if (method === "destroy") {
          msg.destroy();
        } else {
          (msg[method] as (content: string, duration?: number) => void)(
            "Hello",
            duration,
          );
        }
      }}
    >
      Show
    </button>
  );
}

describe("Message", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders children", () => {
    render(
      <MessageProvider>
        <span data-testid="child">App</span>
      </MessageProvider>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("opens a message", async () => {
    render(
      <MessageProvider>
        <TestMessage />
      </MessageProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(await screen.findByText("Hello")).toBeInTheDocument();
  });

  it("renders success icon", async () => {
    render(
      <MessageProvider>
        <TestMessage method="success" />
      </MessageProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("auto-removes message after duration", async () => {
    render(
      <MessageProvider>
        <TestMessage duration={1} />
      </MessageProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });

  it("destroys all messages", async () => {
    render(
      <MessageProvider>
        <TestMessage />
      </MessageProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show" }));
    act(() => {
      message.destroy();
    });
    expect(screen.queryByText("Hello")).not.toBeInTheDocument();
  });
});
