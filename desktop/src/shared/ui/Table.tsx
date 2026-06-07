// src/components/MinimalTable.tsx

// src/components/table/types.ts
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
};

export function MinimalTable<T extends object>({ data, columns }: Props<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
      <table className="w-full">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr
              key={hg.id}
              className="bg-gray-50 dark:bg-white/[0.03] border-b border-gray-200 dark:border-white/10"
            >
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-4 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-400 uppercase tracking-wider"
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
          {table.getRowModel().rows.map((row, i) => (
            <tr
              key={row.id}
              className={`${
                i % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-white/[0.01]"
              } hover:bg-gray-100 dark:hover:bg-white/[0.04] transition-colors`}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="px-4 py-2.5 border-t border-gray-100 dark:border-white/[0.06] text-sm text-gray-900 dark:text-white whitespace-nowrap"
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
