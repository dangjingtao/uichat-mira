export type ColumnAlign = "left" | "center" | "right";

interface ColumnMeta<TData extends object, TValue = unknown> {
  align?: ColumnAlign;
  width?: number | string;
  nowrap?: boolean;
  mono?: boolean;
  muted?: boolean;
  formatter?: (value: TValue, row: TData) => React.ReactNode;
}

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";

type Props<T> = {
  data: T[];
  columns: ColumnDef<T, any>[];
  className?: string;
  stickyHeader?: boolean;
  stickyFirstColumn?: boolean;
};

export function MinimalTable<T extends object>({
  data,
  columns,
  className = "",
  stickyHeader = false,
  stickyFirstColumn = false,
}: Props<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div
      className={`h-full overflow-auto rounded-xl border border-border bg-surface-primary shadow-shadow-sm ${className}`}
    >
      <table className="min-w-full border-collapse">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b border-border bg-surface-secondary">
              {hg.headers.map((h, columnIndex) => (
                <th
                  key={h.id}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary ${
                    stickyHeader ? "sticky top-0 z-20 bg-surface-secondary" : ""
                  } ${
                    stickyFirstColumn && columnIndex === 0
                      ? "sticky left-0 z-30 bg-surface-secondary shadow-[1px_0_0_0_rgb(var(--color-border))]"
                      : ""
                  }`}
                  style={{
                    width: h.getSize(),
                    minWidth: h.column.columnDef.minSize,
                  }}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>

        <tbody>
          {table.getRowModel().rows.map((row, index) => (
            <tr
              key={row.id}
              className={`group transition-colors duration-150 hover:bg-surface-secondary/80 ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              {row.getVisibleCells().map((cell, columnIndex) => (
                <td
                  key={cell.id}
                  className={`whitespace-nowrap px-4 py-3 text-sm text-text-primary ${
                    stickyFirstColumn && columnIndex === 0
                      ? "sticky left-0 z-10 bg-surface-primary shadow-[1px_0_0_0_rgb(var(--color-border))] group-hover:bg-surface-secondary/80"
                      : ""
                  }`}
                  style={{
                    width: cell.column.getSize(),
                    minWidth: cell.column.columnDef.minSize,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default MinimalTable;
