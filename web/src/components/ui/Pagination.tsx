import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { IconButton } from "./IconButton";

type PaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** Résumé à gauche (« 3 paiements »). */
  label?: string;
  className?: string;
};

/** Pages à afficher : toutes jusqu'à 7, sinon la première, la dernière et les voisines de la page courante. */
export function visiblePages(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const around = [page - 1, page, page + 1].filter((p) => p > 1 && p < pageCount);
  const result: (number | "…")[] = [1];
  if (around[0] > 2) result.push("…");
  result.push(...around);
  if (around[around.length - 1] < pageCount - 1) result.push("…");
  result.push(pageCount);
  return result;
}

/** Pagination de tableau (planche « Cartes », « Tableau et pagination »). */
export function Pagination({ page, pageCount, onPageChange, label, className }: PaginationProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <span className="text-xs leading-[18px] text-discret">{label}</span>
      <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
        <IconButton
          icon={ArrowLeft01Icon}
          label="Page précédente"
          variant="contour"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        {visiblePages(page, pageCount).map((p, i) =>
          p === "…" ? (
            <span key={`ellipse-${i}`} aria-hidden="true" className="flex h-[34px] min-w-[34px] items-center justify-center text-[13px] text-discret">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => p !== page && onPageChange(p)}
              className={cn(
                "focus-etudium cible-tactile relative flex h-[34px] min-w-[34px] cursor-pointer items-center justify-center rounded-puce px-1 text-[13px] transition-colors",
                p === page ? "bg-bleu-clair font-semibold text-bleu" : "bg-transparent font-medium text-texte hover:bg-coque",
              )}
            >
              {p}
            </button>
          ),
        )}
        <IconButton
          icon={ArrowRight01Icon}
          label="Page suivante"
          variant="contour"
          size="sm"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        />
      </nav>
    </div>
  );
}
