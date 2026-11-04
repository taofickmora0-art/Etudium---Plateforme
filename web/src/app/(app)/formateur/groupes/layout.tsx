import { Suspense, type ReactNode } from "react";
import { ListeEnAttente, PageGroupes } from "@/components/groupes/PageGroupes";
import { VoletsGroupes } from "@/components/groupes/VoletsGroupes";
import { HAUTEUR_VOLETS } from "@/components/ui/DeuxVolets";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { requireSpace } from "@/lib/auth/require-space";

async function Liste() {
  await requireSpace("formateur");
  return <PageGroupes espace="formateur" />;
}

/** Les Groupes du formateur en deux volets : réservés à son espace, rien n'est rendu avant la vérification. */
export default function Layout({ children }: { children: ReactNode }) {
  // Le volet ouvert se lit dans l'adresse, à l'exécution : la mise en page attend dans sa propre limite de Suspense.
  return (
    <Suspense fallback={<Skeleton className={cn(HAUTEUR_VOLETS, "rounded-carte")} />}>
      <VoletsGroupes
        liste={
          <Suspense fallback={<ListeEnAttente />}>
            <Liste />
          </Suspense>
        }
      >
        {children}
      </VoletsGroupes>
    </Suspense>
  );
}
