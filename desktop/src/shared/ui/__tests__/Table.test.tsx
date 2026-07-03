// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MinimalTable } from "../Table";

type Row = { id: string; name: string; age: number };

const data: Row[] = [
  { id: "1", name: "Alice", age: 30 },
  { id: "2", name: "Bob", age: 25 },
];

const columns = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "age", header: "Age" },
];

describe("MinimalTable", () => {
  it("renders headers and rows", () => {
    render(<MinimalTable data={data} columns={columns} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("renders empty state", () => {
    render(
      <MinimalTable
        data={[]}
        columns={columns}
        emptyState={<span data-testid="empty">No data</span>}
      />,
    );
    expect(screen.getByTestId("empty")).toBeInTheDocument();
  });

  it("supports row selection", () => {
    const handleChange = vi.fn();
    render(
      <MinimalTable
        data={data}
        columns={columns}
        rowSelection={{
          selectedRowIds: ["1"],
          onSelectedRowIdsChange: handleChange,
          getRowId: (row) => row.id,
        }}
      />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes[1]).toBeChecked();

    fireEvent.click(checkboxes[2]);
    expect(handleChange).toHaveBeenCalledWith(["1", "2"]);
  });

  it("toggles select all", () => {
    const handleChange = vi.fn();
    render(
      <MinimalTable
        data={data}
        columns={columns}
        rowSelection={{
          selectedRowIds: [],
          onSelectedRowIdsChange: handleChange,
          getRowId: (row) => row.id,
        }}
      />,
    );
    const selectAll = screen.getByRole("checkbox", { name: "Select all rows" });
    fireEvent.click(selectAll);
    expect(handleChange).toHaveBeenCalledWith(["1", "2"]);
  });

  it("applies compact size", () => {
    render(<MinimalTable data={data} columns={columns} compact />);
    expect(screen.getByText("Alice").closest("td")).toHaveClass("px-3");
  });
});
