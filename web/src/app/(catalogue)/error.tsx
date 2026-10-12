"use client";

import { Alert02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Erreur dans le catalogue ou une fiche (Supabase injoignable, coupure réseau) : on le dit en français et on propose de
 * réessayer. Le cadre (public ou coque de l’appli) reste affiché autour.
 */
export default function CatalogueError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <EmptyState
      icon={Alert02Icon}
      title="Une erreur est survenue"
      description="Vérifiez votre connexion, puis réessayez."
      action={<Button onClick={() => retry()}>Réessayer</Button>}
    />
  );
}
