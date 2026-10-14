import Link from "next/link";
import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Espace } from "@/lib/communaute/types";

/**
 * Un espace de parcours fermé au compte (design NdCommunaute ; spec, §3). Avant les abonnements (lot 2), on y entre en
 * commençant une formation du parcours.
 */
export function EspaceVerrouille({ espace }: { espace: Espace }) {
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
