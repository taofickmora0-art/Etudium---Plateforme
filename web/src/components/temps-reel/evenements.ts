"use client";

import { useEffect, useEffectEvent } from "react";

// Les événements du temps réel (migration 0044), relayés dans la page par <TempsReel> : la cloche, la pastille et l'écran
// des messages, et le bandeau « Nouvelles publications » les écoutent pour se relire aussitôt.

export type EvenementTempsReel = "notification" | "message" | "publication";

/** Le nom de l'événement de la page (pour qui l'écoute dans son propre effet). */
export const nomEvenementTempsReel = (evenement: EvenementTempsReel) => `etudium:temps-reel:${evenement}`;
const nom = nomEvenementTempsReel;

/** Relaie un événement reçu de Supabase à tout ce qui l'écoute dans la page. */
export function signalerTempsReel(evenement: EvenementTempsReel) {
  window.dispatchEvent(new Event(nom(evenement)));
}

/** Appelle `rappel` à chaque événement reçu (le dernier rappel rendu, sans réabonnement). */
export function useTempsReel(evenement: EvenementTempsReel, rappel: () => void) {
  const appeler = useEffectEvent(rappel);
  useEffect(() => {
    const ecouter = () => appeler();
    window.addEventListener(nom(evenement), ecouter);
    return () => window.removeEventListener(nom(evenement), ecouter);
  }, [evenement]);
}
