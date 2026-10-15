"use client";

import { useEffect, useSyncExternalStore } from "react";
import { compterMessagesNonLus } from "@/lib/messages/actions";
import type { EspaceMessages } from "@/lib/messages/types";

// Le nombre de conversations non lues (pastille de l'entrée « Messages »), partagé par la page : la barre latérale et
// le tiroir du téléphone lisent la même valeur. Une lecture à la fois, 20 s au moins entre deux lectures (sauf
// relecture demandée par l'écran Messages après avoir lu une conversation) ; relue chaque minute, onglet visible.

const INTERVALLE_MS = 60_000;
const ECART_MIN_MS = 20_000;

let espaceCourant: EspaceMessages | null = null;
let nombre = 0;
let derniereLecture = 0;
let enCours: Promise<void> | null = null;
const abonnes = new Set<() => void>();

function publier(n: number) {
  if (n === nombre) return;
  nombre = n;
  abonnes.forEach((prevenir) => prevenir());
}

function relire(espace: EspaceMessages, force = false): Promise<void> {
  if (espace !== espaceCourant) {
    espaceCourant = espace;
    derniereLecture = 0;
    publier(0);
  }
  if (enCours || (!force && Date.now() - derniereLecture < ECART_MIN_MS)) return enCours ?? Promise.resolve();
  derniereLecture = Date.now();
  enCours = compterMessagesNonLus(espace)
    .then((n) => {
      if (espace === espaceCourant) publier(n);
    }, () => undefined)
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

/** L'écran Messages vient de lire une conversation : la pastille se relit tout de suite. */
export function rafraichirMessagesNonLus(espace: EspaceMessages) {
  void relire(espace, true);
}

/** Pour les tests : repart de zéro. */
export function reinitialiserMessagesNonLus() {
  espaceCourant = null;
  nombre = 0;
  derniereLecture = 0;
  enCours = null;
}

const sAbonner = (prevenir: () => void) => {
  abonnes.add(prevenir);
  return () => {
    abonnes.delete(prevenir);
  };
};

/** Le nombre de conversations non lues de l'espace ; `actif` faux (pas de compte, autre espace) : 0, sans lecture. */
export function useMessagesNonLus(espace: EspaceMessages | null, actif = true): number {
  const n = useSyncExternalStore(sAbonner, () => (espace && espace === espaceCourant ? nombre : 0), () => 0);
  useEffect(() => {
    if (!actif || !espace) return;
    void relire(espace);
    const minuterie = setInterval(() => {
      if (document.visibilityState === "visible") void relire(espace);
    }, INTERVALLE_MS);
    return () => clearInterval(minuterie);
  }, [espace, actif]);
  return n;
}
