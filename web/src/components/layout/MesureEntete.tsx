"use client";

import { useEffect } from "react";

/**
 * L'en-tête de l'espace connecté reste collé en haut quand la page défile (demande du 31 octobre 2026) ; la barre
 * latérale, figée elle aussi, se colle juste dessous. Sa hauteur (89 px sur ordinateur, plus si une loupe agrandie le fait
 * passer sur deux lignes) est mesurée ici et posée sur la page (`--entete-app`), que la barre latérale lit.
 */
export function MesureEntete() {
  useEffect(() => {
    const entete = document.querySelector<HTMLElement>("[data-entete-app]");
    if (!entete || typeof ResizeObserver === "undefined") return;
    const mesurer = () => document.documentElement.style.setProperty("--entete-app", `${Math.round(entete.getBoundingClientRect().height)}px`);
    // Une première mesure tout de suite, puis à chaque changement de taille.
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(entete);
    return () => observateur.disconnect();
  }, []);
  return null;
}
