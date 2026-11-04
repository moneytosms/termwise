import { parse } from "libpg-query";

export const ALLOWED_VIEWS = ["v_students", "v_subject_attendance", "v_student_subject_attendance", "v_marks", "v_fee_dues", "v_risk_flags"];
const ALLOWED_FUNCTIONS = new Set(["count", "sum", "avg", "min", "max", "round", "coalesce", "lower", "upper", "date_trunc", "now", "current_date", "greatest", "least", "abs", "to_char", "pg_catalog.date_part", "date_part", "extract"]);

type Node = Record<string, unknown>;

function walk(node: unknown, visit: (key: string, value: Node) => void) {
  if (Array.isArray(node)) { node.forEach((n) => walk(n, visit)); return; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === "object" && !Array.isArray(v)) visit(k, v as Node);
      walk(v, visit);
    }
  }
}

const nameOf = (fn: Node) => ((fn.funcname as { String: { sval: string } }[]) ?? []).map((p) => p.String.sval).join(".");

/**
 * First line of defence: exactly one plain SELECT over allowlisted views and functions.
 * The database is the real boundary: a read-only role that can only see the campus-filtered views.
 */
export async function validateQuery(query: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  let tree: { stmts: { stmt: Node }[] };
  try { tree = (await parse(query)) as unknown as typeof tree; } catch { return { ok: false, reason: "not valid SQL" }; }
  if (tree.stmts.length !== 1) return { ok: false, reason: "must be one statement" };
  const stmt = tree.stmts[0].stmt;
  if (!stmt.SelectStmt) return { ok: false, reason: "must be a SELECT" };

  const cteNames = new Set<string>();
  let problem: string | null = null;
  walk(stmt, (k, v) => {
    if (k === "CommonTableExpr" && typeof v.ctename === "string") cteNames.add(v.ctename);
  });
  walk(stmt, (k, v) => {
    if (problem) return;
    if (k === "RangeVar") {
      const rel = v.relname as string;
      if (v.schemaname || (!ALLOWED_VIEWS.includes(rel) && !cteNames.has(rel))) problem = `relation ${rel} is not allowed`;
    }
    if (k === "FuncCall" && !ALLOWED_FUNCTIONS.has(nameOf(v))) problem = `function ${nameOf(v)} is not allowed`;
    if (k === "CommonTableExpr" && !(v.ctequery as Node)?.SelectStmt) problem = "only SELECT is allowed";
    if (k === "RangeFunction" || k === "IntoClause" || k === "LockingClause") problem = `${k} is not allowed`;
    if (k === "SelectStmt" && (v.intoClause || v.lockingClause)) problem = "SELECT INTO and locks are not allowed";
  });
  return problem ? { ok: false, reason: problem } : { ok: true };
}
