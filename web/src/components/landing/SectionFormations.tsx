import Link from "next/link";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { CarteFormation } from "@/components/catalogue/CarteFormation";
import { Button } from "@/components/ui/Button";
import { GRILLE_QUATRE_OU_DEUX } from "@/components/ui/grilles";
import { Icon } from "@/components/ui/Icon";
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <EnTeteSection pastille="Formations" ton="bleu" titre="Pour bien commencer" idTitre="titre-formations" />
        <Button asChild variant="gris" size="lg" className="max-sm:h-auto max-sm:min-h-11 max-sm:py-2.5 max-sm:text-[15px] max-sm:whitespace-normal">
          <Link href="/formations">
            <span>Voir tout le catalogue</span>
            <Icon icon={ArrowRight02Icon} size={20} />
          </Link>
        </Button>
      </div>
      <div className={`mt-9 max-sm:mt-6 max-sm:gap-3 ${GRILLE_QUATRE_OU_DEUX}`}>
        {choix.map((carte) => (
          <CarteFormation key={carte.id} carte={carte} variante="public" titleAs="h3" />
        ))}
      </div>
    </section>
  );
}
