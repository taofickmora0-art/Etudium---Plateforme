"use client";

import { useEffect, useState } from "react";
import { nomEvenementTempsReel } from "@/components/temps-reel/evenements";
import { compterNouvellesPublications } from "@/lib/communaute/nouvelles";
import type { NouvellesPublications } from "@/lib/communaute/types";

// Le bandeau « Nouvelles publications » (liste du 31 octobre 2026, tâche 9) : le fil demande ce qui est paru depuis sa
// plus récente aussitôt qu'une publication paraît (temps réel, 0044 ; une seconde d'attente regroupe les rafales), et en
// secours toutes les 30 s, onglet visible, et au retour sur l'onglet (10 s au moins entre deux de ces demandes). Le fil
// vient d'être lu : la première demande attend. Un autre espace ou un autre repère repart de zéro.

const INTERVALLE_MS = 30_000;
const ECART_MIN_MS = 10_000;
const REGROUPEMENT_MS = 1_000;
const EVENEMENT = nomEvenementTempsReel("publication");
const RIEN: NouvellesPublications = { nombre: 0, auteurs: [] };

/**
 * Ce qui est paru dans `espace` après `apres` (la plus récente du fil, ISO ; null pour un fil vide) ; `actif` faux : rien,
 * sans demande. `effacer` retire le bandeau (le fil va être relu).
 */
export function useNouvellesPublications(espace: string, apres: string | null, actif: boolean) {
  const cle = `${espace}|${apres ?? ""}`;
  const [lu, setLu] = useState<{ cle: string; nouvelles: NouvellesPublications } | null>(null);

  useEffect(() => {
    if (!actif) return;
    const cleLue = `${espace}|${apres ?? ""}`;
    let derniere = Date.now();
    let enCours = false;
    let annule = false;
    let regroupement: ReturnType<typeof setTimeout> | undefined;
    async function verifier(signalee = false) {
      if (enCours || (!signalee && (document.visibilityState !== "visible" || Date.now() - derniere < ECART_MIN_MS))) return;
      enCours = true;
      derniere = Date.now();
      const nouvelles = await compterNouvellesPublications(espace, apres).catch(() => RIEN);
      enCours = false;
      if (!annule) setLu({ cle: cleLue, nouvelles });
    }
    const minuterie = setInterval(() => void verifier(), INTERVALLE_MS);
    const retour = () => void verifier();
    const paru = () => {
      clearTimeout(regroupement);
      regroupement = setTimeout(() => void verifier(true), REGROUPEMENT_MS);
    };
    document.addEventListener("visibilitychange", retour);
    window.addEventListener(EVENEMENT, paru);
    return () => {
      annule = true;
      clearInterval(minuterie);
      clearTimeout(regroupement);
      document.removeEventListener("visibilitychange", retour);
      window.removeEventListener(EVENEMENT, paru);
    };
  }, [espace, apres, actif]);

  return {
    nouvelles: actif && lu?.cle === cle ? lu.nouvelles : RIEN,
    effacer: () => setLu(null),
  };
}
