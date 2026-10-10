import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Column<T> = {
  key: string;
  header: string;
  /** Contenu de la cellule ; par défaut la valeur `row[key]`. */
  render?: (row: T) => ReactNode;
  align?: "left" | "right";
};

type DataTableProps<T> = {
  /** Titre du tableau, lu par les lecteurs d'écran (« Historique des paiements »). */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string;
  className?: string;
};

/**
 * Tableau de la planche « Cartes » : en-tête sur fond de page, lignes de 73 px séparées par un filet.
 * Sur un petit écran il garde 640 px et défile horizontalement dans son cadre (cadre atteignable au clavier).
 */
export function DataTable<T>({ caption, columns, rows, rowKey, className }: DataTableProps<T>) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className={cn("focus-etudium overflow-x-auto rounded-carte border border-bordure-carte", className)}
    >
      <table className="w-full min-w-[640px] border-collapse text-sm leading-5 text-texte">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "bg-page px-4 py-3.5 text-[13px] font-medium whitespace-nowrap text-ardoise",
                  col.align === "right" ? "text-right" : "text-left",
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey ? rowKey(row, index) : index}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "h-[73px] border-t border-bordure-carte px-4 py-2 align-middle",
                    col.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
