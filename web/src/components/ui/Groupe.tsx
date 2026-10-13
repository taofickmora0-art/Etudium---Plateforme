import { useId, type ReactNode } from "react";
import Link from "next/link";
import { Tag } from "./Tag";

/**
 * Une section titrée (annexe 1.9 §0.2, GROUPE) : titre h2, étiquette neutre facultative (« 4 », « 3 éléments »), lien à
 * droite facultatif. La section est nommée par son titre (repère pour les lecteurs d'écran).
 */
export function Groupe({ titre, etiquette, lien, children }: { titre: string; etiquette?: string; lien?: { href: string; libelle: string }; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 id={id} className="m-0 text-xl leading-7 font-semibold text-encre">
            {titre}
          </h2>
          {etiquette && <Tag tone="enAttente">{etiquette}</Tag>}
        </div>
        {lien && (
          <Link href={lien.href} className="focus-etudium text-sm leading-[22px] font-medium text-bleu no-underline hover:underline">
            {lien.libelle}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
