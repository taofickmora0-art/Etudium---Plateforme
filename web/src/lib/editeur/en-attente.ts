"use client";

import { useSyncExternalStore } from "react";

// Les enregistrements pas encore confirmés de la page (point reporté du lot 4) : chaque éditeur dit s'il lui reste
// quelque chose à enregistrer ; la fenêtre « Publier les modifications » prévient qu'une modification ne partira pas.

const enAttente = new Set<string>();
const abonnes = new Set<() => void>();

export function noterAttente(cle: string, attente: boolean): void {
  if (attente === enAttente.has(cle)) return;
  if (attente) enAttente.add(cle);
  else enAttente.delete(cle);
  for (const f of abonnes) f();
}

export function enregistrementsEnAttente(): boolean {
  return enAttente.size > 0;
}

function abonner(f: () => void) {
  abonnes.add(f);
  return () => {
    abonnes.delete(f);
  };
}

export function useEnregistrementsEnAttente(): boolean {
  return useSyncExternalStore(abonner, enregistrementsEnAttente, () => false);
}
