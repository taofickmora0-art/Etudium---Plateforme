"use client";

import { useEffect, useState } from "react";

/** La part de l'écran cachée par le clavier, la hauteur encore visible et le haut de la partie visible (en px). */
export type Clavier = { cache: number; visible: number; haut: number };

/**
 * Sur téléphone, le clavier ouvert (null sans clavier). Il ne réduit que la zone visible (visualViewport) : un élément
 * collé en bas restait dessous (« Nouveau message » de la messagerie, capture du 3 novembre 2026). La fenêtre (Dialog) et
 * la discussion d'un groupe s'en servent pour rester au-dessus du clavier.
 */
export function useClavier(actif: boolean): Clavier | null {
  const [clavier, setClavier] = useState<Clavier | null>(null);
  useEffect(() => {
    if (!actif) return;
    const vue = window.visualViewport;
    if (!vue || typeof window.matchMedia !== "function") return;
    const telephone = window.matchMedia("(max-width: 639px)");
    const mesurer = () => {
      const cache = Math.round(window.innerHeight - vue.height - vue.offsetTop);
      // Moins de 40 px : une barre du navigateur qui bouge, pas un clavier.
      setClavier(telephone.matches && cache > 40 ? { cache, visible: Math.round(vue.height), haut: Math.round(vue.offsetTop) } : null);
    };
    mesurer();
    vue.addEventListener("resize", mesurer);
    vue.addEventListener("scroll", mesurer);
    return () => {
      vue.removeEventListener("resize", mesurer);
      vue.removeEventListener("scroll", mesurer);
      setClavier(null);
    };
  }, [actif]);
  return clavier;
}
