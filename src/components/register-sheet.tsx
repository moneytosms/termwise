/**
 * An attendance register drawn in code: roll numbers down, periods across, each cell marked in turn.
 * Pure CSS animation with a fixed pattern, so server and client render the same; still under reduced motion.
 */
const ROWS = ["0401", "0402", "0403", "0404", "0405", "0406", "0407", "0408", "0409", "0410", "0411", "0412"];
const PERIODS = ["09:00", "09:50", "10:50", "11:40", "13:30", "14:20", "15:05"];
// A fixed, believable spread: mostly present, a few absent (A) and late (L).
const MARK = (r: number, c: number) => ((r * 7 + c * 13) % 23 === 0 ? "A" : (r * 5 + c * 3) % 29 === 0 ? "L" : (r + c * 11) % 31 === 0 ? "A" : "P");

export function RegisterSheet() {
  return (
    <figure className="w-full max-w-lg" aria-label="An attendance register filling in, period by period">
      <div className="overflow-hidden rounded-xl bg-card shadow-float">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm">
          <span className="font-medium">Computer Organisation · CSE-2024</span>
          <span className="text-muted-foreground tabular-nums">Thu 5 Nov</span>
        </div>
        <table className="w-full table-fixed text-xs tabular-nums" aria-hidden>
          <thead>
            <tr className="text-muted-foreground">
              <th className="w-14 py-2 pl-4 text-left font-normal">Roll</th>
              {PERIODS.map((p) => <th key={p} className="py-2 font-normal">{p}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((roll, r) => (
              <tr key={roll} className="border-t border-rule">
                <td className="py-1.5 pl-4 text-muted-foreground">{roll}</td>
                {PERIODS.map((_, c) => {
                  const m = MARK(r, c);
                  return (
                    <td key={c} className="py-1.5 text-center">
                      <span className={`register-cell inline-grid size-5 place-items-center rounded font-medium ${m === "P" ? "bg-data-soft text-data" : m === "A" ? "bg-absent-soft text-absent" : "bg-late-soft text-late"}`}
                        style={{ animationDelay: `${c * 520 + r * 45}ms` }}>{m}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
