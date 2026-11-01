import Link from "next/link";
import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FicheFormation } from "@/lib/catalogue/types";
import { verrou } from "@/lib/lecon/regles";

/**
 * À la place de la vidéo d'une leçon fermée : pourquoi, et quoi faire (compte gratuit, connexion, formules, aperçu).
 * Rien du contenu de la leçon n'est envoyé.
 */
export function LeconVerrouillee({ fiche, leconId, connecte }: { fiche: FicheFormation; leconId: string; connecte: boolean }) {
  const v = verrou(fiche, connecte, leconId);
  const suite = encodeURIComponent(adresseLecon(fiche.slug, leconId));
  return (
    <EmptyState
      icon={SquareLock02Icon}
      title={v.titre}
      description={v.texte}
      action={
        <>
          {v.inscription && (
            <Button asChild>
              <Link href="/inscription">Créer un compte gratuit</Link>
            </Button>
          )}
          {v.formules && (
            <Button asChild>
              <Link href="/abonnement">Voir les abonnements</Link>
            </Button>
          )}
          {v.connexion && (
            <Button asChild variant="contour">
              <Link href={`/connexion?next=${suite}`}>Se connecter</Link>
            </Button>
          )}
          {v.apercu && (
            <Button asChild variant="contour">
              <Link href={adresseLecon(fiche.slug, v.apercu.id)}>Voir l’aperçu gratuit</Link>
            </Button>
          )}
        </>
      }
    />
  );
}
