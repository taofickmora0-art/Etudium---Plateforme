import Link from "next/link";
import { ArrowLeft02Icon, ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import type { FicheFormation } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { voisines } from "@/lib/lecon/regles";

type Props = { fiche: FicheFormation; leconId: string };

/** Ordinateur (NdLecon §2.6) : « Leçon précédente » à gauche, « Leçon suivante » à droite ; une voisine absente disparaît. */
export function NavigationLecon({ fiche, leconId }: Props) {
  const { precedente, suivante } = voisines(fiche.modules, leconId);
  if (!precedente && !suivante) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 max-lg:hidden">
      {precedente && (
        <Link href={adresseLecon(fiche.slug, precedente.id)} className={buttonVariants({ variant: "contour" })}>
          <Icon icon={ArrowLeft02Icon} size={18} />
          <span>Leçon précédente</span>
        </Link>
      )}
      {suivante && (
        <Link href={adresseLecon(fiche.slug, suivante.id)} className={cn(buttonVariants({ variant: "contour" }), "ml-auto")}>
          <span>Leçon suivante</span>
          <Icon icon={ArrowRight02Icon} size={18} />
        </Link>
      )}
    </div>
  );
}

/**
 * Barre basse du téléphone (NdMobLecon §3.8), toujours visible. La tâche 1.7 y placera « Marquer comme terminée » ;
 * d'ici là, « Leçon suivante » tient la place du bouton principal.
 */
export function BarreLecon({ fiche, leconId }: Props) {
  const { precedente, suivante } = voisines(fiche.modules, leconId);
  return (
    <div className="flex gap-2">
      {precedente && (
        <Link href={adresseLecon(fiche.slug, precedente.id)} className={cn(buttonVariants({ variant: "contour" }), "h-12 flex-none px-2.5")}>
          Leçon précédente
        </Link>
      )}
      {suivante && (
        <Link href={adresseLecon(fiche.slug, suivante.id)} className={cn(buttonVariants(), "h-12 min-w-0 flex-1 px-2.5")}>
          Leçon suivante
        </Link>
      )}
    </div>
  );
}
