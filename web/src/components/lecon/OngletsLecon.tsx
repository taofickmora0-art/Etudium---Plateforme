import type { ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

type Props = { programme: ReactNode; ressources: ReactNode; notes: ReactNode };

/**
 * Onglets sous la vidéo. Ordinateur (NdLecon §2.8) : Ressources (ouvert) et Notes, le programme étant à gauche.
 * Téléphone (NdMobLecon §3.4) : Programme (ouvert), Ressources et Notes, en pleine largeur.
 * Deux blocs, l'un masqué selon la largeur : chaque écran garde son onglet ouvert par défaut, sans script.
 * L'onglet Questions arrive au lot 5 (spec Q9).
 */
export function OngletsLecon({ programme, ressources, notes }: Props) {
  return (
    <>
      <SegmentedTabs
        label="Contenu de la leçon"
        className="hidden gap-5 lg:flex"
        items={[
          { value: "ressources", label: "Ressources", content: ressources },
          { value: "notes", label: "Notes", content: notes },
        ]}
      />
      <SegmentedTabs
        label="Contenu de la leçon"
        pleineLargeur
        className="gap-5 lg:hidden"
        items={[
          { value: "programme", label: "Programme", content: programme },
          { value: "ressources", label: "Ressources", content: ressources },
          { value: "notes", label: "Notes", content: notes },
        ]}
      />
    </>
  );
}
