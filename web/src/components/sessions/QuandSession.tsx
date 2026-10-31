"use client";

import { useFuseau } from "@/components/dates/useFuseau";
import { quandSession, type FormeQuand } from "@/lib/sessions/regles";

/**
 * Le moment d'une session live, à l'heure de l'appareil, avec son décalage GMT (tâche 10 du 31 octobre 2026) :
 * « Samedi 24 octobre · 15 h 00 (GMT+1) » au Bénin, « … · 14 h 00 (GMT) » au Togo. Utilisable dans un composant serveur.
 */
export function QuandSession({ debut, forme = "date" }: { debut: string; forme?: FormeQuand }) {
  return <>{quandSession(debut, useFuseau(), forme)}</>;
}
