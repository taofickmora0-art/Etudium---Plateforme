import Link from "next/link";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { CarteFormation } from "@/components/catalogue/CarteFormation";
import { Button } from "@/components/ui/Button";
import { GRILLE_QUATRE_OU_DEUX } from "@/components/ui/grilles";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { formationsPourBienCommencer } from "@/lib/landing/selection";
import { EnTeteSection, SECTION_BLANCHE } from "./BlocsLanding";

/**
 * « Pour bien commencer » (NdLanding §8) : quatre formations publiées (règle de `formationsPourBienCommencer`) et le
 * lien vers tout le catalogue. Aucune formation publiée : la section disparaît.
 */
export function SectionFormations({ cartes }: { cartes: CarteCatalogue[] }) {
  const choix = formationsPourBienCommencer(cartes);
  if (choix.length === 0) return null;
  return (
    <section aria-labelledby="titre-formations" className={SECTION_BLANCHE}>
      <EnTeteFormations />
      <div className={`mt-9 max-sm:mt-6 max-sm:gap-3 ${GRILLE_QUATRE_OU_DEUX}`}>
        {choix.map((carte) => (
          <CarteFormation key={carte.id} carte={carte} titleAs="h3" />
        ))}
      </div>
    </section>
  );
}

/**
 * La section pendant la lecture des formations : même titre et place des quatre cartes réservée, pour que les ancres
 * situées plus bas (« Tarifs », « Questions fréquentes ») ne bougent pas quand les cartes arrivent.
 */
export function FormationsEnAttente() {
  return (
    <section aria-labelledby="titre-formations" aria-busy="true" className={SECTION_BLANCHE}>
      <EnTeteFormations />
      <div className={`mt-9 max-sm:mt-6 max-sm:gap-3 ${GRILLE_QUATRE_OU_DEUX}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            data-carte-en-attente
            aria-hidden="true"
            className="box-border flex min-w-0 flex-col overflow-hidden rounded-carte border border-bordure-carte bg-panneau"
          >
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="flex flex-col px-[19px] pt-4 pb-[17px]">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="mt-[11px] h-10 w-full" />
              <Skeleton className="mt-[29px] h-[18px] w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Titre de la section et « Voir tout le catalogue ». */
function EnTeteFormations() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <EnTeteSection pastille="Formations" ton="bleu" titre="Pour bien commencer" idTitre="titre-formations" />
      <Button asChild variant="gris" size="lg" className="max-sm:h-auto max-sm:min-h-11 max-sm:py-2.5 max-sm:text-[15px] max-sm:whitespace-normal">
        <Link href="/formations">
          <span>Voir tout le catalogue</span>
          <Icon icon={ArrowRight02Icon} size={20} />
        </Link>
      </Button>
    </div>
  );
}
