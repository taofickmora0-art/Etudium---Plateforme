"use client";

import { useEffect, useSyncExternalStore } from "react";
import { suivreGroupes, useTempsReelGroupes } from "@/components/temps-reel/groupes";
import { chargerMesGroupes } from "@/lib/groupes/actions";
import { totalNonLus } from "@/lib/groupes/regles";
import type { ResumeGroupe } from "@/lib/groupes/types";

// Le total des messages non lus dans les groupes (pastille de l'entrée « Groupes »), partagé par la page : la barre
// latérale et le bouton ≡ du téléphone lisent la même valeur. Ses groupes sont suivis en temps réel (0075) : un message
// dans l'un d'eux fait relire le total, 3 s au moins entre deux lectures (sauf relecture demandée par la discussion après
// avoir lu). Relu chaque minute en secours, onglet visible. Avant la 0075, plus aucune lecture.

const INTERVALLE_MS = 60_000;
const ECART_MIN_MS = 3_000;

let nombre = 0;
let derniereLecture = 0;
let enCours: Promise<void> | null = null;
let absente = false;
let prevue: ReturnType<typeof setTimeout> | null = null;
const abonnes = new Set<() => void>();

function publier(n: number) {
  if (n === nombre) return;
  nombre = n;
  abonnes.forEach((prevenir) => prevenir());
}

function relire(force = false): Promise<void> {
  if (absente) return Promise.resolve();
  if (enCours || (!force && Date.now() - derniereLecture < ECART_MIN_MS)) return enCours ?? Promise.resolve();
  derniereLecture = Date.now();
  enCours = chargerMesGroupes()
    .then((r) => {
      if (!r.ok) {
        if (r.absente) absente = true;
        return;
      }
      const groupes: ResumeGroupe[] = r.groupes;
      suivreGroupes("menu", groupes.filter((g) => g.actif).map((g) => g.id));
      publier(totalNonLus(groupes));
    }, () => undefined)
    .finally(() => {
      enCours = null;
    });
  return enCours;
}

/** Un message arrive : relu dès que l'écart minimal est passé (aucun n'est perdu, plusieurs ne font qu'une lecture). */
function relireBientot() {
  if (prevue) return;
  const reste = Math.max(0, ECART_MIN_MS - (Date.now() - derniereLecture));
  prevue = setTimeout(() => {
    prevue = null;
    void relire(true);
  }, reste);
}

/** La discussion vient de marquer des messages lus, ou la liste s'est relue : la pastille se relit tout de suite. */
export function rafraichirGroupesNonLus() {
  void relire(true);
}

/** Pour les tests : repart de zéro. */
export function reinitialiserGroupesNonLus() {
  nombre = 0;
  derniereLecture = 0;
  enCours = null;
  absente = false;
  if (prevue) clearTimeout(prevue);
  prevue = null;
  suivreGroupes("menu", []);
}

const sAbonner = (prevenir: () => void) => {
  abonnes.add(prevenir);
  return () => {
    abonnes.delete(prevenir);
  };
};

/** Le total des non-lus des groupes ; `actif` faux (pas de compte, back-office) : 0, sans lecture. */
export function useGroupesNonLus(actif = true): number {
  const n = useSyncExternalStore(sAbonner, () => (actif ? nombre : 0), () => 0);
  useTempsReelGroupes((signal) => {
    if (actif && signal.evenement === "message") relireBientot();
  });
  useEffect(() => {
    if (!actif) return;
    void relire();
    const minuterie = setInterval(() => {
      if (document.visibilityState === "visible") void relire();
    }, INTERVALLE_MS);
    return () => clearInterval(minuterie);
  }, [actif]);
  return n;
}
