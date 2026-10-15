"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type EtatLecon = {
  terminee: boolean;
  marquerTerminee: () => void;
  /** Leçon vidéo : elle se termine en la regardant, pas avec le bouton (spec Q3). */
  avecVideo: boolean;
  seuil: number;
  /** Compte connecté, leçon ouverte et progression disponible en base : le bouton de fin s'affiche. */
  actif: boolean;
  /** Le lecteur TikTok ou Tella ne répond pas : la leçon se termine d'un clic (jamais d'impasse). */
  mesureImpossible: () => void;
};

const Contexte = createContext<EtatLecon | null>(null);

/**
 * L'état « terminée » de la leçon, partagé entre le lecteur (qui annonce la validation), le bouton de fin de la ligne
 * de navigation et celui de la barre du téléphone (qui est dans le cadre, hors du contenu).
 */
export function EtatLeconProvider({
  termineeInitiale,
  avecVideo,
  seuil,
  actif,
  children,
}: {
  termineeInitiale: boolean;
  avecVideo: boolean;
  seuil: number;
  actif: boolean;
  children: ReactNode;
}) {
  const [terminee, setTerminee] = useState(termineeInitiale);
  const [sansMesure, setSansMesure] = useState(false);
  return (
    <Contexte
      value={{ terminee, marquerTerminee: () => setTerminee(true), avecVideo: avecVideo && !sansMesure, seuil, actif, mesureImpossible: () => setSansMesure(true) }}
    >
      {children}
    </Contexte>
  );
}

/** L'état de la leçon, ou null hors d'une page leçon. */
export const useEtatLecon = () => useContext(Contexte);
