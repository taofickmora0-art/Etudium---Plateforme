import Link from "next/link";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import type { FicheFormation } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";
import { voisines } from "@/lib/lecon/regles";
import { BoutonFin } from "./BoutonFin";

type Props = { fiche: FicheFormation; leconId: string };

/**
 * Ordinateur (NdLecon §2.6) : « Leçon précédente » à gauche ; à droite, « Terminer la leçon › », qui devient « Leçon
 * suivante › » une fois la leçon terminée (refonte des formations, §1.2). Une voisine absente disparaît.
 */
export function NavigationLecon({ fiche, leconId }: Props) {
  const { precedente, suivante } = voisines(fiche.modules, leconId);
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 max-lg:hidden">
      {precedente && (
        <Link href={adresseLecon(fiche.slug, precedente.id)} className={buttonVariants({ variant: "contour" })}>
          <Icon icon={ArrowLeft02Icon} size={18} />
          <span>Leçon précédente</span>
        </Link>
      )}
      <div className="ml-auto flex flex-wrap items-start gap-2">
        <BoutonFin
          leconId={leconId}
          variante="ordinateur"
          suivante={suivante ? adresseLecon(fiche.slug, suivante.id) : undefined}
          formation={`/formations/${fiche.slug}`}
        />
      </div>
    </div>
  );
}

/**
 * Barre basse du téléphone (NdMobLecon §3.8), toujours visible : « Leçon précédente » et le bouton de fin, qui mène à
 * la leçon suivante une fois la leçon terminée (et pour un visiteur, qui n'a rien à terminer).
 */
export function BarreLecon({ fiche, leconId }: Props) {
  const { precedente, suivante } = voisines(fiche.modules, leconId);
  return (
    <div className="flex items-end gap-2">
      {precedente && (
        <Link href={adresseLecon(fiche.slug, precedente.id)} className={cn(buttonVariants({ variant: "contour" }), "h-12 flex-[0_1_auto] px-2.5 text-center leading-[18px] whitespace-normal")}>
          Leçon précédente
        </Link>
      )}
      <div className="flex min-w-0 flex-1">
        <BoutonFin leconId={leconId} variante="telephone" suivante={suivante ? adresseLecon(fiche.slug, suivante.id) : undefined} />
      </div>
    </div>
  );
}
