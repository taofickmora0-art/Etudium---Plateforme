"use client";

import { useEffect } from "react";
import { ouvrirLecon } from "@/lib/lecon/actions";

/**
 * Note la visite de la leçon (« Continuer » reprend à la dernière leçon ouverte). Elle part du navigateur, une fois la
 * page affichée : un simple préchargement de lien ne compte pas comme une visite.
 */
export function VisiteLecon({ leconId }: { leconId: string }) {
  useEffect(() => {
    void ouvrirLecon(leconId).catch(() => undefined);
  }, [leconId]);
  return null;
}
