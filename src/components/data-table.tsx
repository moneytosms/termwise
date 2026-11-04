"use client";

import { useMemo, useState } from "react";
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
import { EmptyState } from "./states";

export type TableFilter<T> = { label: string; options: string[]; get: (row: T) => string | null };

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

export function DataTable<T>({ data, columns, searchPlaceholder = "Search", filters = NO_FILTERS, initialFilters = {}, onRowClick, bulkActions, exportName, emptyTitle, emptyAction, pageSize = 20 }: {
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
}) {
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [visibility, setVisibility] = useState<VisibilityState>({});
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

  const table = useReactTable({
    data: filtered, columns: allColumns,
    state: { globalFilter: search, sorting, columnVisibility: visibility, rowSelection: selection },
    onGlobalFilterChange: setSearch, onSortingChange: setSorting, onColumnVisibilityChange: setVisibility, onRowSelectionChange: setSelection,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    // Callers pass inline columns, so data and columns change identity on every parent render.
    // The automatic page reset would then set state during render forever; reset on search and filter changes instead.
    autoResetPageIndex: false,
  });

  function exportCsv() {
    const cols = table.getVisibleLeafColumns().filter((c) => typeof c.columnDef.header === "string" && c.accessorFn);
    const rows = table.getFilteredRowModel().rows;
    const csv = toCsv(rows, cols.map((c) => ({ header: c.columnDef.header as string, value: (r: (typeof rows)[number]) => r.getValue(c.id) })));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${exportName}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const selected = table.getSelectedRowModel().rows.map((r) => r.original);
  const rows = table.getRowModel().rows;
  const total = table.getFilteredRowModel().rows.length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 md:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input aria-label={searchPlaceholder} placeholder={searchPlaceholder} className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); table.setPageIndex(0); }} />
        </div>
        {filters.map((f) => (
          <select key={f.label} aria-label={f.label} value={picked[f.label] ?? ""}
            onChange={(e) => { setPicked((p) => ({ ...p, [f.label]: e.target.value })); table.setPageIndex(0); }}
            className="h-9 rounded-md border bg-card px-2 text-sm">
            <option value="">{f.label}: all</option>
            {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ))}
        <span className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}><Columns3 className="size-4" aria-hidden />Columns</DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table.getAllLeafColumns().filter((c) => c.getCanHide() && typeof c.columnDef.header === "string").map((c) => (
              <DropdownMenuCheckboxItem key={c.id} checked={c.getIsVisible()} onCheckedChange={(v) => c.toggleVisibility(!!v)}>{c.columnDef.header as string}</DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {exportName && <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" aria-hidden />Export</Button>}
      </div>

      {selected.length > 0 && bulkActions && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm">
          <span className="font-medium">{selected.length} selected</span>
          {bulkActions(selected, () => setSelection({}))}
          <Button size="sm" variant="ghost" onClick={() => setSelection({})}>Clear</Button>
        </div>
      )}

      {total === 0 ? (
        data.length === 0
          ? <EmptyState title={emptyTitle} action={emptyAction} />
          : <EmptyState title="Nothing matches these filters." action={<Button size="sm" variant="outline" onClick={() => { setSearch(""); setPicked({}); }}>Clear filters</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((g) => (
                <TableRow key={g.id}>
                  {g.headers.map((h) => (
                    <TableHead key={h.id} aria-sort={h.column.getIsSorted() === "asc" ? "ascending" : h.column.getIsSorted() === "desc" ? "descending" : undefined}>
                      {h.column.getCanSort() ? (
                        <button className="inline-flex items-center gap-1 font-medium" onClick={h.column.getToggleSortingHandler()}>
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
                  {r.getVisibleCells().map((c) => <TableCell key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total} {total === 1 ? "row" : "rows"}</span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>Previous</Button>
            <span>Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span>
            <Button size="sm" variant="outline" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>Next</Button>
          </span>
        </div>
      )}
    </div>
  );
}
