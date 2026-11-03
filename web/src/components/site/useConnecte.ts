"use client";

import { useSyncExternalStore } from "react";
import { hasSessionCookie } from "@/lib/auth/routing";

// Les pages publiques (landing, catalogue, fiches) restent les mêmes pour tous : seul l'en-tête change pour un compte
// connecté (« Accéder à l'espace membre », demande du 3 novembre 2026). Le cookie de session de Supabase est lisible
// par la page : on le lit ici, sans rendre la page dynamique côté serveur. Une session expirée mène à /accueil, qui
// renvoie vers la connexion en le disant.
const nomsDesCookies = () =>
  document.cookie
    .split(";")
    .map((c) => c.split("=")[0]?.trim() ?? "")
    .filter(Boolean);

const rien = () => () => {};

/** Vrai quand un cookie de session est présent ; faux au rendu serveur (le bon bouton suit dès l'affichage). */
export function useConnecte(): boolean {
  return useSyncExternalStore(rien, () => hasSessionCookie(nomsDesCookies()), () => false);
}
