"use client";

import { useState } from "react";
import { FilterChips } from "@/components/ui/FilterChips";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

const FILTRES = [
  { value: "toutes", label: "Toutes" },
  { value: "en-cours", label: "En cours" },
  { value: "terminees", label: "Terminées" },
  { value: "verrouillees", label: "Verrouillées" },
  { value: "favoris", label: "Favoris" },
];

const ONGLETS = ["Informations", "Notifications", "Sécurité"].map((label) => ({
  value: label.toLowerCase(),
  label,
  content: <p className="m-0 text-sm text-discret">Contenu de l’onglet « {label} ».</p>,
}));

function Legende({ children }: { children: string }) {
  return <p className="m-0 text-xs leading-[18px] text-ardoise">{children}</p>;
}

/** Démo interactive : un filtre ou un onglet se sélectionne au clic. */
export function FiltresDemo() {
  const [filtre, setFiltre] = useState("toutes");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <FilterChips label="Filtrer mes formations" options={FILTRES} value={filtre} onValueChange={setFiltre} />
      <Legende>Filtres : le filtre actif passe en bleu clair, texte bleu.</Legende>
      <SegmentedTabs label="Paramètres du compte" items={ONGLETS} className="gap-3" />
      <Legende>Onglets : piste grise, pastille blanche et texte bleu, comme l’entrée active de la barre latérale.</Legende>
    </div>
  );
}
