import { useId, type ReactNode } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { Tag } from "@/components/ui/Tag";

// Blocs des tableaux de bord (back-office, espace formateur) : tuiles de chiffres et cartes titrées.

// Quatre chiffres clés par rangée au plus, puis trois, deux, un (tuiles de 200 px au moins).
export const GRILLE_CHIFFRES = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(200px,calc((100%-60px)/4))),1fr))] gap-5";
export const RANGEE = "flex flex-wrap items-stretch gap-5";


/** Un chiffre clé (planche « Cartes », indicateurs) ; `data-tuile` la repère dans les tests. */
export function Tuile(props: Parameters<typeof StatCard>[0] & { children?: ReactNode }) {
  const { children, ...carte } = props;
  return (
    <div data-tuile="" className="flex min-w-0 flex-col">
      <StatCard {...carte} className="flex-1">
        {children}
      </StatCard>
    </div>
  );
}

/** Un bloc titré ; `lot` : ce qu'il montrera arrive avec ce lot. */
export function Carte({ titre, lot, className, children }: { titre: string; lot?: number; className?: string; children: ReactNode }) {
  const id = useId();
  return (
    <section
      data-tuile=""
      aria-labelledby={id}
      className={`box-border flex min-w-0 flex-col gap-3 rounded-carte border border-bordure-carte bg-panneau px-5 py-[18px] ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="m-0 text-base leading-6 font-semibold text-encre">
          {titre}
        </h2>
        {lot && <Tag tone="enAttente">{`Disponible au lot ${lot}`}</Tag>}
      </div>
      {children}
    </section>
  );
}

export const AVENIR = "flex min-h-[92px] items-center justify-center rounded-champ border border-dashed border-bordure-champ px-4 text-center text-[13px] leading-5 text-discret";
