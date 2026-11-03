"use client";

import Link from "next/link";
import { Alert02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Erreur dans le lecteur d'un livre (Supabase injoignable, coupure réseau) : on le dit en français et on propose de
 * réessayer. Le lecteur dessine lui-même son cadre ; ici, une page simple sur le fond de l'appli.
 */
export default function LecteurError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center bg-page p-4">
      <EmptyState
        icon={Alert02Icon}
        title="Une erreur est survenue"
        description="Vérifiez votre connexion, puis réessayez."
        className="w-full max-w-xl"
        action={
          <>
            <Button onClick={() => retry()}>Réessayer</Button>
            <Button asChild variant="contour">
              <Link href="/bibliotheque">La bibliothèque</Link>
            </Button>
          </>
        }
      />
    </main>
  );
}
