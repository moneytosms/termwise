import Link from "next/link";
import { cn } from "@/lib/utils";

const pill = "inline-flex h-8 items-center rounded-full px-3 text-sm transition-colors";

/** Clamps a `page` search param to [1, pages] and returns that page's slice. */
export function paginate<T>(items: T[], pageParam: string | undefined, size: number) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(pageParam)) || 1));
  return { items: items.slice((page - 1) * size, page * size), page, pages };
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3">
      {page > 1
        ? <Link href={href(page - 1)} className={cn(pill, "bg-secondary text-foreground/80 hover:bg-muted")}>Previous</Link>
        : <span aria-disabled="true" className={cn(pill, "bg-secondary/50 text-muted-foreground")}>Previous</span>}
      <span className="text-sm text-muted-foreground tabular-nums">Page {page} of {pages}</span>
      {page < pages
        ? <Link href={href(page + 1)} className={cn(pill, "bg-secondary text-foreground/80 hover:bg-muted")}>Next</Link>
        : <span aria-disabled="true" className={cn(pill, "bg-secondary/50 text-muted-foreground")}>Next</span>}
    </nav>
  );
}
