"use client";

import { useSyncExternalStore } from "react";
import type { Domaine } from "./domaines";

// Les domaines du compte connecté, côté navigateur, pour le menu du back-office. La coque s'affiche avant la lecture
// du compte : tant qu'ils ne sont pas connus (null), le menu ne montre que le tableau de bord. L'en-tête du compte les
// fixe dès qu'il est lu (DomainesDuCompte).

let courants: Domaine[] | null = null;
const abonnes = new Set<() => void>();

export function fixerDomaines(domaines: Domaine[] | null): void {
  courants = domaines;
  for (const f of abonnes) f();
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

export function useDomaines(): Domaine[] | null {
  return useSyncExternalStore(
    abonner,
    () => courants,
    () => null,
  );
}
