import { useId } from "react";
import Link from "next/link";
import type { CarteLivre } from "@/lib/bibliotheque/types";
import { CarteLivreCompacte } from "./CarteDeLivre";

/**
 * « Pour aller plus loin » sur la fiche d'une formation (spec du 3 novembre 2026, §1) : les livres que l'équipe y
 * recommande (livres_formation, 0074), en petites cartes vers leur fiche. Rien s'il n'y en a pas (ni sans la 0074).
 */
export function PourAllerPlusLoin({ livres }: { livres: CarteLivre[] }) {
  const id = useId();
  if (livres.length === 0) return null;
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1.5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={id} className="m-0 text-xl leading-7 font-semibold text-encre max-sm:text-lg max-sm:leading-[26px]">
            Pour aller plus loin
          </h2>
          <p className="m-0 text-sm leading-[22px] text-pretty text-discret max-sm:text-[13px] max-sm:leading-5">Des livres de la bibliothèque, choisis pour cette formation.</p>
        </div>
        <Link href="/bibliotheque" className="focus-etudium flex-none text-sm leading-[22px] font-medium text-bleu no-underline hover:underline max-sm:text-[13px]">
          Toute la bibliothèque
        </Link>
      </div>
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,150px),1fr))] gap-4 p-0 max-sm:grid-cols-2 max-sm:gap-3">
        {livres.map((livre) => (
          <li key={livre.id} className="min-w-0">
            <CarteLivreCompacte livre={livre} />
          </li>
        ))}
      </ul>
    </section>
  );
}
