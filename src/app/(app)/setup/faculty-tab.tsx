"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/select-field";
import type { StaffRole } from "@/domain/roles";
import { saveStaffProfile } from "./actions";
import { editColumn, Field, FormDialog } from "./shared";

const ROLE_LABEL: Record<StaffRole, string> = { faculty: "Faculty", office_admin: "Office admin", admissions: "Admissions", exams: "Exams", accounts: "Accounts", hr: "HR", hod: "Head of department" };
const DESIGNATION_LABEL: Record<string, string> = { professor: "Professor", associate_professor: "Associate Professor", assistant_professor: "Assistant Professor" };

type Row = {
  id: number; name: string; department: string | null; role: StaffRole;
  hasAccount: boolean; subjects: number; mentees: number;
  designation: string | null; qualification: string | null;
};

export function FacultyTab({ rows, canEdit }: { rows: Row[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<Row | null>(null);
  const columns: ColumnDef<Row>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "department", header: "Department", cell: ({ row }) => row.original.department ?? "–" },
    { accessorKey: "role", header: "Role", cell: ({ row }) => ROLE_LABEL[row.original.role] },
    { accessorKey: "designation", header: "Designation", cell: ({ row }) => (row.original.designation ? DESIGNATION_LABEL[row.original.designation] ?? row.original.designation : "Not recorded") },
    { accessorKey: "qualification", header: "Qualification", cell: ({ row }) => row.original.qualification ?? "Not recorded" },
    { accessorKey: "hasAccount", header: "Signed-in account", cell: ({ row }) => (row.original.hasAccount ? "Yes" : "No") },
    { accessorKey: "subjects", header: "Subjects taught", cell: ({ row }) => <span className="tabular-nums">{row.original.subjects}</span> },
    { accessorKey: "mentees", header: "Mentees", cell: ({ row }) => <span className="tabular-nums">{row.original.mentees}</span> },
    ...(canEdit ? [editColumn<Row>(setEditing)] : []),
  ];

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">Accounts are created by the college&apos;s administrator.</p>
      <DataTable data={rows} columns={columns} searchPlaceholder="Search staff" exportName="faculty"
        emptyTitle="No staff on this campus yet." />
      {canEdit && (
        <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} id={editing?.id}
          title="Edit staff profile" description={editing ? editing.name : undefined} submitLabel="Save" action={saveStaffProfile}>
          <Field label="Designation">
            <SelectField name="designation" aria-label="Designation" defaultValue={editing?.designation ?? ""}
              options={[
                { value: "", label: "Not recorded" },
                { value: "professor", label: "Professor" },
                { value: "associate_professor", label: "Associate Professor" },
                { value: "assistant_professor", label: "Assistant Professor" },
              ]} />
          </Field>
          <Field label="Qualification" hint="For example Ph.D., M.Tech. Up to 80 characters.">
            <Input name="qualification" maxLength={80} defaultValue={editing?.qualification ?? ""} />
          </Field>
        </FormDialog>
      )}
    </>
  );
}
