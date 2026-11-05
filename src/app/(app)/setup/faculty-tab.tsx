"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";

type Row = {
  id: number; name: string; department: string | null; role: "faculty" | "office_admin";
  hasAccount: boolean; subjects: number; mentees: number;
};

export function FacultyTab({ rows }: { rows: Row[] }) {
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "department", header: "Department", cell: ({ row }) => row.original.department ?? "–" },
    { accessorKey: "role", header: "Role", cell: ({ row }) => (row.original.role === "office_admin" ? "Office admin" : "Faculty") },
    { accessorKey: "hasAccount", header: "Signed-in account", cell: ({ row }) => (row.original.hasAccount ? "Yes" : "No") },
    { accessorKey: "subjects", header: "Subjects taught", cell: ({ row }) => <span className="tabular-nums">{row.original.subjects}</span> },
    { accessorKey: "mentees", header: "Mentees", cell: ({ row }) => <span className="tabular-nums">{row.original.mentees}</span> },
  ];

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">Accounts are created by the college&apos;s administrator.</p>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search staff" exportName="faculty"
        emptyTitle="No staff on this campus yet." />
    </>
  );
}
