"use client";

import { useEffect } from "react";
import { verrouillerResultats } from "@/lib/resultats/actions";

/** Sans un geste pendant ce temps, l'espace se reverrouille (le jeton de la base dure autant). */
export const INACTIVITE_RESULTATS_MS = 15 * 60_000;

const GESTES = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/**
 * La minuterie d'un espace protégé par un code : 15 minutes sans geste, il se reverrouille. Au retour sur l'onglet (un
 * téléphone met les minuteries en pause), le temps passé compte aussi.
 */
export function MinuterieResultats() {
  useEffect(() => {
    let dernierGeste = Date.now();
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let fini = false;
    const verrouiller = () => {
      if (fini) return;
      fini = true;
      void verrouillerResultats();
    };
    const relancer = () => {
      dernierGeste = Date.now();
      clearTimeout(minuterie);
      minuterie = setTimeout(verrouiller, INACTIVITE_RESULTATS_MS);
    };
    const auRetour = () => {
      if (document.visibilityState === "visible" && Date.now() - dernierGeste >= INACTIVITE_RESULTATS_MS) verrouiller();
    };
    relancer();
    for (const geste of GESTES) document.addEventListener(geste, relancer, { passive: true, capture: true });
    document.addEventListener("visibilitychange", auRetour);
    return () => {
      clearTimeout(minuterie);
      for (const geste of GESTES) document.removeEventListener(geste, relancer, { capture: true });
      document.removeEventListener("visibilitychange", auRetour);
    };
  }, []);
  return null;
}
