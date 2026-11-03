"use client";

import { useEffect, useEffectEvent, useSyncExternalStore } from "react";

// Le temps réel des groupes (migration 0075) : chaque groupe a son sujet privé « groupe:<id> ». La page suit les groupes
// que demandent ses écrans (la pastille du menu, la liste « Groupes », la discussion ouverte) ; <TempsReelGroupes> s'y
// abonne et relaie chaque événement dans la page : « message » (un message ajouté) ou « changement » (modifié, supprimé,
// une réaction, l'épingle). Rien du contenu ne passe par là : chacun relit ce qui le concerne.

export type EvenementGroupe = "message" | "changement";
export type SignalGroupe = { groupe: string; evenement: EvenementGroupe };

const NOM = "etudium:temps-reel:groupe";
const sources = new Map<string, string[]>();
let suivis: string[] = [];
const abonnes = new Set<() => void>();

function recalculer() {
  const union = [...new Set([...sources.values()].flat())].sort();
  if (union.join(",") === suivis.join(",")) return;
  suivis = union;
  abonnes.forEach((prevenir) => prevenir());
}

/** Les groupes qu'un écran suit (`[]` : il n'en suit plus). */
export function suivreGroupes(source: string, groupes: string[]) {
  if (groupes.length === 0) sources.delete(source);
  else sources.set(source, groupes);
  recalculer();
}

function sAbonner(prevenir: () => void) {
  abonnes.add(prevenir);
  return () => {
    abonnes.delete(prevenir);
  };
}

/** Les groupes suivis par la page, triés. */
export function useGroupesSuivis(): string[] {
  return useSyncExternalStore(sAbonner, () => suivis, () => suivis);
}

/** Relaie un événement reçu de Supabase à tout ce qui l'écoute dans la page. */
export function signalerGroupe(groupe: string, evenement: EvenementGroupe) {
  window.dispatchEvent(new CustomEvent<SignalGroupe>(NOM, { detail: { groupe, evenement } }));
}

/** Appelle `rappel` à chaque événement d'un groupe (le dernier rappel rendu, sans réabonnement). */
export function useTempsReelGroupes(rappel: (signal: SignalGroupe) => void) {
  const appeler = useEffectEvent(rappel);
  useEffect(() => {
    const ecouter = (e: Event) => {
      const detail = (e as CustomEvent<SignalGroupe>).detail;
      if (detail?.groupe) appeler(detail);
    };
    window.addEventListener(NOM, ecouter);
    return () => window.removeEventListener(NOM, ecouter);
  }, []);
}

/** Pour les tests : plus aucun groupe suivi. */
export function reinitialiserGroupesSuivis() {
  sources.clear();
  suivis = [];
}
