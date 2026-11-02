import type { ReactNode } from "react";
import { connection } from "next/server";
import { quandVersion } from "@/lib/editeur/historique";
import { lireVersions } from "@/lib/editeur/versions";
import { OngletHistorique } from "./OngletHistorique";

/**
 * L'onglet « Historique » d'une formation et sa version en ligne (« Version 8 · aujourd’hui ») pour l'onglet
 * Publication (fin du lot 4, spec §3.3). Sans version (ou avant la 0057) : ni onglet, ni version.
 */
export async function ongletHistorique(formationId: string): Promise<{ onglet: ReactNode | undefined; version: string | null }> {
  const lu = await lireVersions(formationId).catch(() => ({ migrationAbsente: true as const }));
  if (lu.migrationAbsente || lu.donnees.length === 0) return { onglet: undefined, version: null };
  // « aujourd’hui » se calcule à la demande, pas au moment de la construction de la page.
  await connection();
  // La version que la base marque en ligne ; aucune pour une formation repassée en brouillon.
  const enLigne = lu.donnees.find((v) => v.enLigne);
  return {
    onglet: <OngletHistorique versions={lu.donnees} />,
    version: enLigne ? `Version ${enLigne.numero} · ${quandVersion(enLigne.creeLe, new Date())}` : null,
  };
}
