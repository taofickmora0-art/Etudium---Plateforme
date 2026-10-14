import { useId } from "react";
import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { VueCarteSuivie } from "@/components/mes-formations/CarteSuivie";
import { CarteSuivieCompacte } from "@/components/mes-formations/CarteSuivieCompacte";
import { Icon } from "@/components/ui/Icon";
import { Heading } from "@/components/ui/Text";

/** Jusqu'à 6 petites cartes côte à côte (spec Formations et Événements, §2). */
export const RANGEE_MAX = 6;

/**
 * « Mes formations » en haut de la page Formations : les formations ouvertes le plus récemment, sur une seule ligne (sur
 * un écran étroit, la rangée défile en largeur), et « Voir plus » vers la liste complète. Rien tant qu'aucune n'est commencée.
 */
export function ListeMesFormations({ suivies }: { suivies: VueCarteSuivie[] }) {
  const titre = useId();
  if (suivies.length === 0) return null;
  return (
    <section aria-labelledby={titre} className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Heading level="section">
          <span id={titre}>Mes formations</span>
        </Heading>
        <Link
          href="/mes-formations"
          className="focus-etudium inline-flex flex-none items-center gap-1 rounded-puce text-sm leading-[22px] font-medium text-bleu no-underline hover:text-bleu-survol"
        >
          Voir plus
          <Icon icon={ArrowRight01Icon} size={16} />
        </Link>
      </div>
      <ul
        aria-label="Mes formations"
        className="m-0 grid list-none auto-cols-[minmax(136px,calc((100%-80px)/6))] grid-flow-col gap-4 overflow-x-auto p-0 pb-1 [scrollbar-width:thin] max-sm:-mx-4 max-sm:px-4"
      >
        {suivies.slice(0, RANGEE_MAX).map((vue) => (
          <li key={vue.id} className="min-w-0">
            <CarteSuivieCompacte vue={vue} />
          </li>
        ))}
      </ul>
    </section>
  );
}
