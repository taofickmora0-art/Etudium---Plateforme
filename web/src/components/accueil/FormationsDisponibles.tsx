import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { CarteFormation } from "@/components/catalogue/CarteFormation";
import { Icon } from "@/components/ui/Icon";
import { Heading } from "@/components/ui/Text";
import type { CarteCatalogue } from "@/lib/catalogue/types";

/** Sous le fil de l'Accueil, les formations les plus récentes et « Voir toutes les formations » (spec du nouvel Accueil, §3). */
export function FormationsDisponibles({ cartes }: { cartes: CarteCatalogue[] }) {
  if (cartes.length === 0) return null;
  return (
    <section aria-label="Formations disponibles" className="mt-4 flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Heading level="section">
          Formations disponibles
        </Heading>
        <Link href="/formations" className="focus-etudium inline-flex items-center gap-1 rounded-puce text-sm leading-5 font-semibold text-bleu hover:underline max-sm:text-[13px]">
          Voir toutes les formations
          <Icon icon={ArrowRight01Icon} size={16} />
        </Link>
      </div>
      {/* Sur téléphone, une rangée qui défile en largeur : la page reste courte. */}
      <div className="grid gap-5 sm:grid-cols-2 max-sm:-mx-4 max-sm:flex max-sm:snap-x max-sm:gap-3 max-sm:overflow-x-auto max-sm:px-4 max-sm:pb-1 max-sm:[scrollbar-width:none]">
        {cartes.map((carte) => (
          <div key={carte.id} className="flex min-w-0 max-sm:w-[248px] max-sm:flex-none max-sm:snap-start">
            <CarteFormation carte={carte} variante="connecte" titleAs="h3" />
          </div>
        ))}
      </div>
    </section>
  );
}
