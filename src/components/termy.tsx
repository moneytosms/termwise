import { useId } from "react";
import { cn } from "@/lib/utils";

/** Nav icon shape shared by lucide icons and TermyIcon. */
export type NavIcon = React.ComponentType<{ className?: string; strokeWidth?: number }>;

export type TermyPose = "idle" | "thinking" | "answer" | "refused" | "error";

const INK = "#1f2530";
const BLUE = "#1d5fbf";

/** Termy, the assistant's owl: slate clay body, round glasses, mortarboard, a register ledger in the data hue. Decorative. */
export function Termy({ pose = "idle", className }: { pose?: TermyPose; className?: string }) {
  const id = useId().replace(/:/g, "");
  const g = (n: string) => `url(#${id}${n})`;
  const tilt = pose === "thinking" ? "rotate(-8 60 52)" : pose === "error" ? "rotate(4 60 52)" : undefined;
  // Pupils look up-right while thinking, down at the ledger when answering.
  const look = pose === "thinking" ? [2, -3] : pose === "answer" ? [0, 2.5] : [0, 0];

  return (
    <svg viewBox="0 0 120 120" aria-hidden className={cn("size-16 overflow-visible", className)}>
      <defs>
        <radialGradient id={`${id}body`} cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#a3aebd" />
          <stop offset="0.55" stopColor="#6c7789" />
          <stop offset="1" stopColor="#434c5c" />
        </radialGradient>
        <radialGradient id={`${id}face`} cx="0.42" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#f2f4f7" />
          <stop offset="1" stopColor="#c3cad5" />
        </radialGradient>
        <radialGradient id={`${id}belly`} cx="0.45" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#dde2e9" />
          <stop offset="1" stopColor="#a9b2bf" />
        </radialGradient>
        <linearGradient id={`${id}book`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a86dc" />
          <stop offset="1" stopColor={BLUE} />
        </linearGradient>
        <linearGradient id={`${id}cap`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a4352" />
          <stop offset="1" stopColor={INK} />
        </linearGradient>
        <radialGradient id={`${id}iris`} cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#6aa2ee" />
          <stop offset="1" stopColor={BLUE} />
        </radialGradient>
      </defs>

      <ellipse cx="60" cy="113" rx="30" ry="4.5" fill="#000" opacity="0.14" />

      <g className={cn(pose === "answer" && "termy-bob")}>
        {/* feet */}
        <ellipse cx="50" cy="108" rx="6" ry="3" fill={INK} />
        <ellipse cx="70" cy="108" rx="6" ry="3" fill={INK} />
        {/* body */}
        <path d="M60 30c-22 0-34 18-34 40 0 22 14 38 34 38s34-16 34-38c0-22-12-40-34-40z" fill={g("body")} />
        <ellipse cx="60" cy="82" rx="20" ry="22" fill={g("belly")} />
        {[76, 84, 92].map((y) => (
          <path key={y} d={`M53 ${y}l3 2.5 3-2.5 3 2.5 3-2.5`} fill="none" stroke="#7d8798" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
        ))}

        {/* ledger, held by both wings */}
        {pose === "answer" ? (
          <g>
            <path d="M34 86l26 4 26-4v18l-26 4-26-4z" fill={g("book")} />
            <path d="M36 84l24 4v17l-24-4z" fill="#fbfcfe" />
            <path d="M84 84l-24 4v17l24-4z" fill="#eef1f6" />
            {[0, 1, 2].map((i) => (
              <g key={i} stroke={BLUE} strokeWidth="1.1" strokeLinecap="round" opacity="0.55">
                <path d={`M40 ${90 + i * 4}l15 2.3`} />
                <path d={`M80 ${90 + i * 4}l-15 2.3`} />
              </g>
            ))}
          </g>
        ) : (
          <g>
            <rect x="44" y="84" width="32" height="22" rx="3" fill={g("book")} />
            <rect x="44" y="84" width="5" height="22" rx="2" fill="#174d9c" />
            <rect x="53" y="90" width="17" height="3" rx="1.5" fill="#fff" opacity="0.7" />
            <rect x="53" y="95" width="11" height="2" rx="1" fill="#fff" opacity="0.45" />
          </g>
        )}
        <ellipse cx="31" cy="88" rx="8" ry="15" transform="rotate(18 31 88)" fill="#4f5a6b" />
        <ellipse cx="89" cy="88" rx="8" ry="15" transform="rotate(-18 89 88)" fill="#4f5a6b" />

        {/* head */}
        <g transform={tilt}>
          <path d="M29 36l5-20 14 12z" fill="#555f70" />
          <path d="M91 36l-5-20-14 12z" fill="#555f70" />
          <ellipse cx="60" cy="50" rx="33" ry="27" fill={g("body")} />
          <path d="M60 33c-8-6-27-5-27 13 0 14 12 22 27 22s27-8 27-22c0-18-19-19-27-13z" fill={g("face")} />
          <ellipse cx="44" cy="31" rx="10" ry="4" fill="#fff" opacity="0.25" />

          {/* eyes */}
          <g className={cn(pose === "idle" && "termy-blink")}>
            {[46, 74].map((x) => (
              <g key={x}>
                <circle cx={x} cy="50" r="8" fill="#fff" />
                <circle cx={x + look[0]} cy={50 + look[1]} r="5" fill={g("iris")} />
                <circle cx={x + look[0]} cy={50 + look[1]} r="2.2" fill={INK} />
                <circle cx={x + look[0] - 1.6} cy={50 + look[1] - 1.8} r="1.3" fill="#fff" />
              </g>
            ))}
          </g>
          {pose === "refused" && (
            <g fill="#c9d0da">
              <path d="M38 50a8 8 0 0 1 16 0z" />
              <path d="M66 50a8 8 0 0 1 16 0z" />
            </g>
          )}
          {pose === "error" && (
            <g stroke={INK} strokeWidth="2" strokeLinecap="round">
              <path d="M38 38l14 3" />
              <path d="M82 38l-14 3" />
            </g>
          )}

          {/* glasses */}
          <g fill="none" stroke={INK} strokeWidth="2.2" transform={pose === "error" ? "rotate(-6 60 50)" : undefined}>
            <circle cx="46" cy="50" r="10" />
            <circle cx="74" cy="50" r="10" />
            <path d="M56 49q4-3 8 0" />
          </g>
          <path d="M60 57l-4 4 4 5 4-5z" fill="#3a4250" />

          {/* mortarboard */}
          <g>
            <path d="M44 27c0-6 32-6 32 0v5c-8-3-24-3-32 0z" fill={INK} />
            <path d="M60 12l30 9-30 9-30-9z" fill={g("cap")} />
            <path d="M60 12l30 9-30 9z" fill="#fff" opacity="0.08" />
            <path d="M60 21l30 0v12" fill="none" stroke={BLUE} strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="90" cy="35" r="2.4" fill={BLUE} />
          </g>
        </g>

        {pose === "error" && <path d="M95 40c0 0-4 5-4 8a4 4 0 0 0 8 0c0-3-4-8-4-8z" fill="#9cc0f2" />}
      </g>

      {pose === "thinking" && (
        <g fill="#5b9bf0">
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={96 + i * 7} cy={22 - i * 4} r={2 + i * 0.6} className="termy-dot" style={{ animationDelay: `${i * 160}ms` }} />
          ))}
        </g>
      )}
    </svg>
  );
}

/** Line-style head for the nav, matching the icon set: tufts, mortarboard and glasses only. */
export function TermyIcon({ className, strokeWidth = 1.75 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M12 3l8 2.5-8 2.5-8-2.5z" />
      <path d="M5.5 9.5C4.5 11 4 12.5 4 14c0 4 3.6 7 8 7s8-3 8-7c0-1.5-.5-3-1.5-4.5" />
      <circle cx="9" cy="14" r="2.3" />
      <circle cx="15" cy="14" r="2.3" />
      <path d="M11.3 13.6h1.4" />
    </svg>
  );
}
