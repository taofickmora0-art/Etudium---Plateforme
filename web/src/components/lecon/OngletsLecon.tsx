import type { ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

type Props = { ressources: ReactNode; notes: ReactNode };

/**
 * Onglets sous la vidéo. Ordinateur (NdLecon §2.8) : Ressources (ouvert) et Notes, le programme étant à gauche.
 * Téléphone (NdMobLecon §3.4) : Ressources et Notes, en pleine largeur ; le programme est dans le tiroir « Leçons »
 * (refonte des formations, §1.4).
 * Deux blocs, l'un masqué selon la largeur : chaque écran garde son onglet ouvert par défaut, sans script.
 * L'onglet Questions arrive au lot 5 (spec Q9).
 */
export function OngletsLecon({ ressources, notes }: Props) {
  // Sans notes (aperçu du formateur ou de l'équipe, tâche 12) : l'onglet Ressources seul.
  const items = [{ value: "ressources", label: "Ressources", content: ressources }, ...(notes ? [{ value: "notes", label: "Notes", content: notes }] : [])];
  return (
    <>
      <SegmentedTabs label="Contenu de la leçon" className="hidden gap-5 lg:flex" items={items} />
      <SegmentedTabs label="Contenu de la leçon" pleineLargeur className="gap-5 lg:hidden" items={items} />
    </>
  );
}
