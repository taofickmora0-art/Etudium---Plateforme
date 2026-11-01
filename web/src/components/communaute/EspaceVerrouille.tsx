import Link from "next/link";
import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { EspaceCommunaute } from "@/lib/communaute/chemins";
import { REPLAYS, type Espace } from "@/lib/communaute/types";

/**
 * Un espace fermé au compte (design NdCommunaute ; spec, §3). Dans un espace de parcours, on entre en commençant une
 * formation du parcours, ou avec un abonnement (lot 2) ; les replays des lives sont réservés aux abonnés (choix 1 du
 * lot 2). Côté formateur (restructuration R1), il ne suit pas de formation : l'espace lui est simplement réservé.
 */
export function EspaceVerrouille({ espace, espaceCompte = "etudiant" }: { espace: Espace; espaceCompte?: EspaceCommunaute }) {
  if (espaceCompte === "formateur") {
    return (
      <EmptyState
        icon={SquareLock02Icon}
        title={`Espace ${espace.nomCourt} verrouillé`}
        description={`Cet espace est réservé aux étudiants du parcours ${espace.nom} et à ses formateurs.`}
      />
    );
  }
  if (espace.id === REPLAYS) {
    return (
      <EmptyState
        icon={SquareLock02Icon}
        title="Replays réservés aux abonnés"
        description="Revoyez chaque live quand vous voulez avec un abonnement."
        action={
          <Button asChild>
            <Link href="/abonnement/souscrire">Voir les abonnements</Link>
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      icon={SquareLock02Icon}
      title={`Espace ${espace.nomCourt} verrouillé`}
      description={`Commencez une formation du parcours ${espace.nom} pour rejoindre son espace.`}
      action={
        <Button asChild>
          <Link href={espace.slug ? `/parcours?parcours=${encodeURIComponent(espace.slug)}` : "/parcours"}>Voir les formations du parcours</Link>
        </Button>
      }
    />
  );
}
