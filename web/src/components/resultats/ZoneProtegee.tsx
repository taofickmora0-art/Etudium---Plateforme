"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { prolongerResultats, verrouillerResultats } from "@/lib/resultats/actions";

/** Sans un geste pendant ce temps, l'espace se reverrouille (le jeton de la base dure autant). */
export const INACTIVITE_RESULTATS_MS = 15 * 60_000;
/** Les gestes prolongent l'ouverture côté base au plus une fois par période (sans enregistrement, rien ne la prolonge). */
const PROLONGATION_MS = 3 * 60_000;

const GESTES = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/** Gardés hors du composant : une page cachée par Next puis revenue (bouton Retour) retrouve le temps passé ailleurs. */
const suivi = { dernierGeste: 0, dernierProlongement: 0 };

/**
 * Le contenu d'un espace protégé par un code.
 * - 15 minutes sans geste : il se reverrouille. Au retour sur l'onglet (un téléphone met les minuteries en pause), le temps
 *   passé compte aussi.
 * - Les gestes prolongent le jeton de la base (au plus toutes les 3 minutes) : on ne perd pas une saisie en cours.
 * - Next garde les pages quittées (cachées) et les réaffiche avec le bouton Retour, sans repasser par le serveur : la page
 *   cachée masque ses résultats, et à son retour, ils ne reviennent qu'après la base (ou le clavier, après 15 minutes).
 */
export function ZoneProtegee({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [masque, setMasque] = useState(false);
  const [, demarrer] = useTransition();
  const cachee = useRef(false);
  // L'effet ne dépend de rien : chacune de ses relances signifie « page cachée puis revenue ».
  const routeur = useRef(router);
  useEffect(() => {
    routeur.current = router;
  }, [router]);

  useLayoutEffect(() => {
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let fini = false;
    const inactif = () => Date.now() - suivi.dernierGeste;
    const programmer = (delai: number) => {
      clearTimeout(minuterie);
      minuterie = setTimeout(verrouiller, Math.max(0, delai));
    };
    function verrouiller() {
      if (fini) return;
      fini = true;
      setMasque(true);
      // L'action rafraîchit la page (le clavier) ; sans réseau, on réessaie un peu plus tard, toujours masqué.
      verrouillerResultats().catch(() => {
        fini = false;
        programmer(30_000);
      });
    }
    const relancer = () => {
      const maintenant = Date.now();
      suivi.dernierGeste = maintenant;
      programmer(INACTIVITE_RESULTATS_MS);
      if (maintenant - suivi.dernierProlongement >= PROLONGATION_MS) {
        suivi.dernierProlongement = maintenant;
        void prolongerResultats().catch(() => undefined);
      }
    };
    const auRetour = () => {
      if (document.visibilityState !== "visible") return;
      if (inactif() >= INACTIVITE_RESULTATS_MS) verrouiller();
      else programmer(INACTIVITE_RESULTATS_MS - inactif());
    };

    if (!cachee.current) {
      // Premier affichage : la base vient de vérifier (et de prolonger) l'ouverture.
      suivi.dernierGeste = suivi.dernierProlongement = Date.now();
      programmer(INACTIVITE_RESULTATS_MS);
    } else {
      cachee.current = false;
      if (inactif() >= INACTIVITE_RESULTATS_MS) verrouiller();
      else {
        programmer(INACTIVITE_RESULTATS_MS - inactif());
        // Les résultats reviennent avec la réponse de la base (le clavier à leur place si l'espace s'est fermé).
        demarrer(() => {
          routeur.current.refresh();
          setMasque(false);
        });
      }
    }
    for (const geste of GESTES) document.addEventListener(geste, relancer, { passive: true, capture: true });
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      clearTimeout(minuterie);
      for (const geste of GESTES) document.removeEventListener(geste, relancer, { capture: true });
      document.removeEventListener("visibilitychange", auRetour);
      // Page quittée (gardée cachée par Next) : ses résultats sont masqués tout de suite.
      cachee.current = true;
      setMasque(true);
    };
  }, []);

  return masque ? <Skeleton className="h-60 rounded-carte" /> : children;
}
