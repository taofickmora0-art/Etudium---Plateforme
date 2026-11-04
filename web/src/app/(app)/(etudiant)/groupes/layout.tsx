import { Suspense, type ReactNode } from "react";
import { ListeEnAttente, PageGroupes } from "@/components/groupes/PageGroupes";
import { VoletsGroupes } from "@/components/groupes/VoletsGroupes";
import { HAUTEUR_VOLETS } from "@/components/ui/DeuxVolets";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

/** Les Groupes en deux volets : la liste à gauche (montée une fois), le groupe ouvert à droite. */
export default function Layout({ children }: { children: ReactNode }) {
  // Le volet ouvert se lit dans l'adresse, à l'exécution : la mise en page attend dans sa propre limite de Suspense.
  return (
    <Suspense fallback={<Skeleton className={cn(HAUTEUR_VOLETS, "rounded-carte")} />}>
      <VoletsGroupes
        liste={
          <Suspense fallback={<ListeEnAttente />}>
            <PageGroupes espace="etudiant" />
          </Suspense>
        }
      >
        {children}
      </VoletsGroupes>
    </Suspense>
  );
}
