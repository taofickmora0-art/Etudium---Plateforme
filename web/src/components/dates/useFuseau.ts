"use client";

import { useSyncExternalStore } from "react";
import { FUSEAU_BENIN, fuseauValide } from "@/lib/dates/fuseau";

// Le fuseau de l'appareil (tâche 10 du 31 octobre 2026) : les heures des lives s'affichent à l'heure de chacun. Le
// serveur ne le connaît pas : le premier rendu (serveur et hydratation) est à l'heure du Bénin, puis le navigateur passe
// à la sienne, sans écart à l'hydratation.

const rien = () => () => {};
const fuseauDeLAppareil = () => {
  const fuseau = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return fuseauValide(fuseau) ? fuseau : FUSEAU_BENIN;
};

/** Le fuseau de l'appareil ; le Bénin au rendu serveur et à l'hydratation. */
export function useFuseau(): string {
  return useSyncExternalStore(rien, fuseauDeLAppareil, () => FUSEAU_BENIN);
}

/** Le fuseau de l'appareil ; null tant qu'il n'est pas connu (rendu serveur, hydratation) : pour un formulaire de saisie. */
export function useFuseauConnu(): string | null {
  return useSyncExternalStore(rien, fuseauDeLAppareil, () => null);
}
