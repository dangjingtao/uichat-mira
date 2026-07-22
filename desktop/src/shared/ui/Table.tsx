import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
} from "@tanstack/react-table";
import Tooltip from "./Tooltip";

export type ColumnAlign = "left" | "center" | "right";

export interface ColumnMeta<TData extends object, TValue = unknown> {
  align?: ColumnAlign;
  width?: number | string;
  nowrap?: boolean;
  mono?: boolean;
  muted?: boolean;
  sticky?: "left";
  ellipsisTooltip?: boolean;
  formatter?: (value: TValue, row: TData) => React.ReactNode;
}

type Props<T> = {
  data: T[];
  columns: ColumnDef<T, any>[];
  className?: string;
  stickyHeader?: boolean;
  stickyFirstColumn?: boolean;
  compact?: boolean;
  emptyState?: React.ReactNode;
  getRowProps?: (row: Row<T>) => React.HTMLAttributes<HTMLTableRowElement>;
  scrollRef?: React.RefObject<HTMLDivElement>;
  rowSelection?: {
    selectedRowIds: string[];
    onSelectedRowIdsChange: (rowIds: string[]) => void;
    getRowId: (row: T) => string;
    ariaLabel?: (row: T) => string;
    selectAllAriaLabel?: string;
  };
};

function OverflowTooltip({
  children,
  text,
  className,
}: {
  children: React.ReactNode;
  text: string;
  className: string;
}) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }

    const checkOverflow = () => {
      setIsOverflowing(element.scrollWidth > element.clientWidth);
    };

    checkOverflow();
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(element);
    window.addEventListener("resize", checkOverflow);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", checkOverflow);
    };
  }, [text]);

  const content = (
    <div ref={contentRef} className={className}>
      {children}
    </div>
  );

  if (!isOverflowing || !text.trim()) {
    return content;
  }

  return <Tooltip text={text}>{content}</Tooltip>;
}

const resolveColumnMeta = <T extends object, TValue>(
  column: ColumnDef<T, TValue>,
): ColumnMeta<T, TValue> => (column.meta ?? {}) as ColumnMeta<T, TValue>;

const resolveAlignClassName = (align: ColumnAlign | undefined) => {
  if (align === "center") {
    return "text-center";
  }
  if (align === "right") {
    return "text-right";
  }
  return "text-left";
};

const resolveColumnWidthPx = <T extends object, TValue>(
  column: ColumnDef<T, TValue>,
  fallbackSize: number,
) => {
  const meta = resolveColumnMeta(column);

  if (typeof meta.width === "number") {
    return meta.width;
  }

  if (typeof meta.width === "string") {
    const parsed = Number.parseFloat(meta.width);
    if (meta.width.endsWith("px") && Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallbackSize;
};

export function MinimalTable<T extends object>({
  data,
  columns,
  className = "",
  stickyHeader = false,
  stickyFirstColumn = false,
  compact = false,
  emptyState,
  getRowProps,
  scrollRef: externalScrollRef,
  rowSelection,
}: Props<T>) {
  const internalScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = externalScrollRef ?? internalScrollRef;
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  const rowSelectionState = useMemo<RowSelectionState>(() => {
    if (!rowSelection) {
      return {};
    }

    return rowSelection.selectedRowIds.reduce<RowSelectionState>((acc, rowId) => {
      acc[rowId] = true;
      return acc;
    }, {});
  }, [rowSelection]);

  const selectionColumn = useMemo<ColumnDef<T, any> | null>(() => {
    if (!rowSelection) {
      return null;
    }

    return {
      id: "__select__",
      size: 40,
      minSize: 40,
      maxSize: 40,
      meta: {
        width: 40,
        sticky: "left",
        align: "center",
      } satisfies ColumnMeta<T>,
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllRowsSelected()}
          ref={(element) => {
            if (element) {
              element.indeterminate =
                table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected();
            }
          }}
          aria-label={rowSelection.selectAllAriaLabel ?? "Select all rows"}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          aria-label={rowSelection.ariaLabel?.(row.original) ?? "Select row"}
          checked={row.getIsSelected()}
          className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
          onClick={(event) => event.stopPropagation()}
          onChange={row.getToggleSelectedHandler()}
        />
      ),
      enableSorting: false,
    };
  }, [rowSelection]);

  const effectiveColumns = useMemo(
    () => (selectionColumn ? [selectionColumn, ...columns] : columns),
    [columns, selectionColumn],
  );

  const table = useReactTable({
    data,
    columns: effectiveColumns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      rowSelection: rowSelectionState,
    },
    onRowSelectionChange: (updater) => {
      if (!rowSelection) {
        return;
      }

      const nextState =
        typeof updater === "function" ? updater(rowSelectionState) : updater;
      rowSelection.onSelectedRowIdsChange(
        Object.entries(nextState)
          .filter(([, selected]) => selected)
          .map(([rowId]) => rowId),
      );
    },
    enableRowSelection: Boolean(rowSelection),
    getRowId: rowSelection?.getRowId,
  });

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }

    const updateShadows = () => {
      const { scrollLeft, clientWidth, scrollWidth } = container;
      setShowLeftShadow(scrollLeft > 0);
      setShowRightShadow(scrollLeft + clientWidth < scrollWidth - 1);
    };

    updateShadows();
    container.addEventListener("scroll", updateShadows, { passive: true });
    window.addEventListener("resize", updateShadows);

    return () => {
      container.removeEventListener("scroll", updateShadows);
      window.removeEventListener("resize", updateShadows);
    };
  }, [data, effectiveColumns]);

  return (
    <div
      className={`relative h-full overflow-hidden rounded-ui-panel border border-border bg-surface-primary ${className}`}
    >
      {showLeftShadow ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-40 w-4 bg-gradient-to-r from-black/8 to-transparent" />
      ) : null}
      {showRightShadow ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-40 w-4 bg-gradient-to-l from-black/8 to-transparent" />
      ) : null}

      <div ref={scrollRef} className="h-full overflow-auto">
        <table className="w-max min-w-full border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              (() => {
                let stickyLeftOffset = 0;

                return (
                  <tr key={headerGroup.id} className="bg-surface-secondary">
                    {headerGroup.headers.map((header, columnIndex) => {
                      const meta = resolveColumnMeta(header.column.columnDef);
                      const stickyLeft =
                        meta.sticky === "left" ||
                        (stickyFirstColumn &&
                          columnIndex === (rowSelection ? 1 : 0));
                      const left = stickyLeftOffset;

                      if (stickyLeft) {
                        stickyLeftOffset += resolveColumnWidthPx(
                          header.column.columnDef,
                          header.getSize(),
                        );
                      }

                      return (
                        <th
                          key={header.id}
                          className={`${resolveAlignClassName(meta.align)} border-b border-border text-[11px] font-medium tracking-[0.02em] text-text-tertiary ${
                            compact ? "px-3 py-2" : "px-4 py-2.5"
                          } ${
                            stickyHeader ? "sticky top-0 z-20 bg-surface-secondary" : ""
                          } ${
                            stickyLeft
                              ? "sticky z-30 bg-surface-secondary shadow-[1px_0_0_0_rgb(var(--color-border)),8px_0_16px_-12px_rgba(15,23,42,0.18)]"
                              : ""
                          }`}
                          style={{
                            width: meta.width ?? header.getSize(),
                            minWidth: meta.width ?? header.column.columnDef.minSize,
                            maxWidth: meta.width ?? header.column.columnDef.maxSize,
                            ...(stickyLeft ? { left: `${left}px` } : {}),
                          }}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </th>
                      );
                    })}
                  </tr>
                );
              })()
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={effectiveColumns.length}
                  className="px-4 py-16 text-center text-sm text-text-secondary"
                >
                  {emptyState ?? null}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, index) => {
                const rowProps = getRowProps?.(row);
                let stickyLeftOffset = 0;

                return (
                  <tr
                    key={row.id}
                    {...rowProps}
                    className={`group transition-colors duration-150 hover:bg-surface-secondary/80 ${
                      index > 0 ? "border-t border-border/80" : ""
                    } ${rowProps?.className ?? ""}`}
                  >
                    {row.getVisibleCells().map((cell, columnIndex) => {
                      const meta = resolveColumnMeta(cell.column.columnDef);
                      const stickyLeft =
                        meta.sticky === "left" ||
                        (stickyFirstColumn &&
                          columnIndex === (rowSelection ? 1 : 0));
                      const left = stickyLeftOffset;

                      if (stickyLeft) {
                        stickyLeftOffset += resolveColumnWidthPx(
                          cell.column.columnDef,
                          cell.column.getSize(),
                        );
                      }

                      const rendered = flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      );
                      const tooltipText = String(cell.getValue() ?? "");

                      return (
                        <td
                          key={cell.id}
                          className={`${meta.nowrap === false ? "" : "whitespace-nowrap"} ${resolveAlignClassName(meta.align)} text-sm text-text-primary ${
                            meta.mono ? "font-mono" : ""
                          } ${meta.muted ? "text-text-secondary" : ""} ${
                            compact ? "px-3 py-2" : "px-4 py-2.5"
                          } ${
                            index === 0 ? "border-t-0" : ""
                          } ${
                            stickyLeft
                              ? "sticky z-10 bg-surface-primary shadow-[1px_0_0_0_rgb(var(--color-border)),8px_0_16px_-12px_rgba(15,23,42,0.18)] group-hover:bg-surface-secondary/80"
                              : ""
                          }`}
                          style={{
                            width: meta.width ?? cell.column.getSize(),
                            minWidth: meta.width ?? cell.column.columnDef.minSize,
                            maxWidth: meta.width ?? cell.column.columnDef.maxSize,
                            ...(stickyLeft ? { left: `${left}px` } : {}),
                          }}
                        >
                          {meta.ellipsisTooltip && tooltipText.trim() ? (
                            <OverflowTooltip
                              text={tooltipText}
                              className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                            >
                              {rendered}
                            </OverflowTooltip>
                          ) : (
                            rendered
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MinimalTable;
