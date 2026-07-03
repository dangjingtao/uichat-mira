// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SearchSelectModal from "../SearchSelectModal";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
}));

import { get } from "@/shared/lib/request";

const items = [
  { id: "1", label: "Apple", description: "Fruit" },
  { id: "2", label: "Banana", description: "Yellow" },
];

describe("SearchSelectModal", () => {
  it("renders loading state", async () => {
    vi.mocked(get).mockResolvedValueOnce({ data: [] });
    render(
      <SearchSelectModal
        open
        title="Pick"
        url="/api/items"
        normalizeItems={(res: { data: typeof items }) => res.data}
        onCheck={() => true}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders items after loading", async () => {
    vi.mocked(get).mockResolvedValueOnce({ data: items });
    render(
      <SearchSelectModal
        open
        title="Pick"
        url="/api/items"
        normalizeItems={(res: { data: typeof items }) => res.data}
        onCheck={() => true}
        onClose={() => {}}
      />,
    );
    expect(await screen.findByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("filters items by search", async () => {
    vi.mocked(get).mockResolvedValueOnce({ data: items });
    render(
      <SearchSelectModal
        open
        title="Pick"
        url="/api/items"
        normalizeItems={(res: { data: typeof items }) => res.data}
        onCheck={() => true}
        onClose={() => {}}
      />,
    );
    await screen.findByText("Apple");
    await userEvent.type(screen.getByRole("textbox"), "Ban");
    expect(screen.queryByText("Apple")).not.toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("calls onCheck when item clicked", async () => {
    vi.mocked(get).mockResolvedValueOnce({ data: items });
    const handleCheck = vi.fn().mockResolvedValue(true);
    render(
      <SearchSelectModal
        open
        title="Pick"
        url="/api/items"
        normalizeItems={(res: { data: typeof items }) => res.data}
        onCheck={handleCheck}
        onClose={() => {}}
      />,
    );
    await screen.findByText("Apple");
    await userEvent.click(screen.getByTitle("Apple"));
    expect(handleCheck).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });

  it("shows error state", async () => {
    vi.mocked(get).mockRejectedValueOnce(new Error("Network error"));
    render(
      <SearchSelectModal
        open
        title="Pick"
        url="/api/items"
        normalizeItems={(res: { data: typeof items }) => res.data}
        onCheck={() => true}
        onClose={() => {}}
      />,
    );
    expect(await screen.findByText("Network error")).toBeInTheDocument();
  });
});
