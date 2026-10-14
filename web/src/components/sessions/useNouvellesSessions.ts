"use client";

import { useEffect, useSyncExternalStore } from "react";
import { compterNouvellesSessions } from "@/lib/sessions/nouvelles";

// Le nombre de nouvelles sessions live (spec promotion des sessions live, §3), partagé par la page : le menu, le bouton
// « Sessions live programmées » et la page Événements lisent la même valeur. Une seule lecture à la fois, 20 s au moins
// entre deux lectures ; relue au changement de page et chaque minute tant que l'onglet est visible.

const INTERVALLE_MS = 60_000;
const ECART_MIN_MS = 20_000;

let nombre = 0;
let derniereLecture = 0;
let enCours: Promise<void> | null = null;
// Une remise à zéro rend caduque la lecture partie avant elle (sinon elle réafficherait l'ancien nombre).
let generation = 0;
const abonnes = new Set<() => void>();

function publier(n: number) {
  if (n === nombre) return;
  nombre = n;
  abonnes.forEach((prevenir) => prevenir());
}

function relire(): Promise<void> {
  if (enCours || Date.now() - derniereLecture < ECART_MIN_MS) return enCours ?? Promise.resolve();
  derniereLecture = Date.now();
  const lancee = generation;
  enCours = compterNouvellesSessions()
    .then((n) => {
      if (lancee === generation) publier(n);
    }, () => undefined)
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

/** La page Événements est ouverte : plus rien de nouveau. */
export function viderNouvellesSessions() {
  generation++;
  derniereLecture = Date.now();
  publier(0);
}

/** Pour les tests : repart de zéro. */
export function reinitialiserNouvellesSessions() {
  generation++;
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

/** Le nombre de nouvelles sessions ; `cle` (l'adresse) relance une lecture quand elle change ; `actif` faux : aucune lecture. */
export function useNouvellesSessions(cle: string | null = null, actif = true): number {
  const n = useSyncExternalStore(sAbonner, () => nombre, () => 0);
  useEffect(() => {
    if (!actif) return;
    void relire();
    const minuterie = setInterval(() => {
      if (document.visibilityState === "visible") void relire();
    }, INTERVALLE_MS);
    return () => clearInterval(minuterie);
  }, [cle, actif]);
  return n;
}
