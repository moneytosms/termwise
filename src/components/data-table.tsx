"use client";

import { useEffect, useMemo, useState } from "react";
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type RowSelectionState, type SortingState, type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Columns3, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState } from "./states";
import { setRowOrder } from "./row-nav";
import { SelectField } from "./select-field";
import { useSettings } from "@/lib/settings";

export type TableFilter<T> = { label: string; options: string[]; get: (row: T) => string | null };

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> { align?: "right"; hidden?: boolean }
}

function toCsv<T>(rows: T[], columns: { header: string; value: (r: T) => unknown }[]) {
  const cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;
  return [columns.map((c) => cell(c.header)).join(","), ...rows.map((r) => columns.map((c) => cell(c.value(r))).join(","))].join("\n");
}

/**
 * The one list used everywhere: search, filters, sortable columns, show/hide columns,
 * paging, row selection with bulk actions, CSV export and an empty state.
 * Columns need `accessorKey` or `accessorFn` plus a string `header` to be exported and hidden.
 */
const NO_FILTERS: never[] = [];

export function DataTable<T>({ data, columns, searchPlaceholder = "Search", filters = NO_FILTERS, initialFilters = {}, onRowClick, bulkActions, exportName, emptyTitle, emptyAction, pageSize, mobile, rowNav }: {
  data: T[];
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  searchPlaceholder?: string;
  filters?: TableFilter<T>[];
  /** Filter label to preset value, usually from the URL. */
  initialFilters?: Record<string, string>;
  onRowClick?: (row: T) => void;
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  exportName?: string;
  emptyTitle: string;
  emptyAction?: React.ReactNode;
  pageSize?: number;
  /** Phone row: identity and key figure on line 1, the other fields on line 2. Replaces the table below md. */
  mobile?: (row: T) => React.ReactNode;
  /** Publishes the shown row order so a RecordModal with the same `key` can step prev/next. */
  rowNav?: { key: string; id: (row: T) => string };
}) {
  const settingsPageSize = useSettings().pageSize;
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>(() =>
    Object.fromEntries(columns.filter((c) => c.meta?.hidden).map((c) => [(c as { accessorKey?: string }).accessorKey ?? c.id, false])));
  const [selection, setSelection] = useState<RowSelectionState>({});
  const [picked, setPicked] = useState<Record<string, string>>(initialFilters);

  const filtered = useMemo(
    () => data.filter((r) => filters.every((f) => !picked[f.label] || f.get(r) === picked[f.label])),
    [data, filters, picked],
  );
  const allColumns = useMemo<ColumnDef<T, any>[]>(() => bulkActions ? [{ // eslint-disable-line @typescript-eslint/no-explicit-any
    id: "select", enableSorting: false, enableHiding: false,
    header: ({ table }) => <Checkbox aria-label="Select all on this page" checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} />,
    cell: ({ row }) => <span onClick={(e) => e.stopPropagation()}><Checkbox aria-label="Select row" checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} /></span>,
  }, ...columns] : columns, [columns, bulkActions]);

  // TanStack Table is not memoizable by React Compiler; skipping it here is fine.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: filtered, columns: allColumns,
    state: { globalFilter: search, sorting, columnVisibility: visibility, rowSelection: selection },
    onGlobalFilterChange: setSearch, onSortingChange: setSorting, onColumnVisibilityChange: setVisibility, onRowSelectionChange: setSelection,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: pageSize ?? settingsPageSize } },
    // Callers pass inline columns, so data and columns change identity on every parent render.
    // The automatic page reset would then set state during render forever; reset on search and filter changes instead.
    autoResetPageIndex: false,
  });

  function exportCsv() {
    // Columns hidden by default (an identity folded into another cell) still export.
    const cols = table.getAllLeafColumns().filter((c) => (c.getIsVisible() || c.columnDef.meta?.hidden) && typeof c.columnDef.header === "string" && c.accessorFn);
    const rows = table.getFilteredRowModel().rows;
    const csv = toCsv(rows, cols.map((c) => ({ header: c.columnDef.header as string, value: (r: (typeof rows)[number]) => r.getValue(c.id) })));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${exportName}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Settings load after hydration, so initialState alone would miss a saved page size.
  useEffect(() => { if (!pageSize) table.setPageSize(settingsPageSize); }, [pageSize, settingsPageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  const order = rowNav ? table.getPrePaginationRowModel().rows.map((r) => rowNav.id(r.original)) : [];
  const orderKey = JSON.stringify(order);
  useEffect(() => { if (rowNav) setRowOrder(rowNav.key, JSON.parse(orderKey)); }, [rowNav?.key, orderKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label={searchPlaceholder} placeholder={searchPlaceholder} className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); table.setPageIndex(0); }} />
        </div>
        {filters.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:overflow-visible md:px-0">
            {filters.map((f) => (
              <SelectField key={f.label} aria-label={f.label} value={picked[f.label] ?? ""} active={!!picked[f.label]} className="shrink-0"
                options={[{ value: "", label: `${f.label}: all` }, ...f.options.map((o) => ({ value: o, label: o }))]}
                onValueChange={(v) => { setPicked((p) => ({ ...p, [f.label]: v })); table.setPageIndex(0); }} />
            ))}
          </div>
        )}
        <span className="hidden flex-1 md:block" />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="hidden md:inline-flex" />}><Columns3 className="size-4" aria-hidden />Columns</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table.getAllLeafColumns().filter((c) => c.getCanHide() && typeof c.columnDef.header === "string").map((c) => (
              <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)}>{c.columnDef.header as string}</DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {exportName && <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={exportCsv}><Download className="size-4" aria-hidden />Export</Button>}
      </div>

      {selected.length > 0 && bulkActions && (
        <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-xl bg-foreground px-3 py-2 text-sm text-background shadow-float md:top-3 [&_[data-slot=button]]:shadow-none">
          <span className="font-medium">{selected.length} selected</span>
          {bulkActions(selected, () => setSelection({}))}
          <Button size="sm" variant="ghost" className="text-background hover:bg-background/10 hover:text-background" onClick={() => setSelection({})}>Clear</Button>
        </div>
      )}

      {total === 0 ? (
        data.length === 0
          ? <EmptyState title={emptyTitle} action={emptyAction} />
          : <EmptyState title="Nothing matches these filters." action={<Button size="sm" variant="outline" onClick={() => { setSearch(""); setPicked({}); }}>Clear filters</Button>} />
      ) : (
        <>
        {mobile && (
          <ul role="table" aria-label="Results" className="divide-y divide-rule overflow-hidden rounded-xl bg-card shadow-sheet md:hidden">
            {rows.map((r) => (
              <li key={r.id} role="row" className={cn("flex items-center gap-3 px-4 py-3", r.getIsSelected() && "bg-data-soft/60")}>
                <div role="cell" className="flex min-w-0 flex-1 items-center gap-3">
                  {bulkActions && <Checkbox aria-label="Select row" checked={r.getIsSelected()} onCheckedChange={(v) => r.toggleSelected(!!v)} />}
                  {onRowClick
                    ? <button className="min-w-0 flex-1 text-left" onClick={() => onRowClick(r.original)}>{mobile(r.original)}</button>
                    : <div className="min-w-0 flex-1">{mobile(r.original)}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className={cn("overflow-x-auto rounded-xl bg-card shadow-sheet", mobile && "hidden md:block")}>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((g) => (
                <TableRow key={g.id}>
                  {g.headers.map((h) => (
                    <TableHead key={h.id} className={cn(h.column.columnDef.meta?.align === "right" && "text-right")} aria-sort={h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : undefined}>
                      {h.column.getCanSort() ? (
                        <button className={cn("inline-flex items-center gap-1 hover:text-foreground", h.column.getIsSorted() && "text-foreground", h.column.columnDef.meta?.align === "right" && "flex-row-reverse")} onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {h.column.getIsSorted() === "asc" && <ArrowUp className="size-3" aria-hidden />}
                          {h.column.getIsSorted() === "desc" && <ArrowDown className="size-3" aria-hidden />}
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} data-state={r.getIsSelected() ? "selected" : undefined}
                  className={onRowClick ? "cursor-pointer" : undefined}
                  onClick={onRowClick ? () => onRowClick(r.original) : undefined}>
                  {r.getVisibleCells().map((c) => <TableCell key={c.id} className={cn(c.column.columnDef.meta?.align === "right" && "text-right")}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular-nums">{(() => {
            const { pageIndex, pageSize: size } = table.getState().pagination;
            return total <= size ? `${total} ${total === 1 ? "row" : "rows"}` : `${pageIndex * size + 1}–${Math.min(total, (pageIndex + 1) * size)} of ${total}`;
          })()}</span>
          {table.getPageCount() > 1 && (
            <span className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Previous</Button>
              <Button size="sm" variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Next</Button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
