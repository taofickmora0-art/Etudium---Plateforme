"use client";

import { useState } from "react";
import { BookOpen02Icon, Download04Icon, LibraryIcon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { GRILLE_CHIFFRES, Tuile } from "@/components/tableau/Blocs";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import type { BibliothequeAdmin, StatutLivre } from "@/lib/bibliotheque/types";
import { GrilleLivres } from "./GrilleLivres";

export type FiltreLivres = "tous" | StatutLivre;

const FILTRES: { value: FiltreLivres; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "publie", label: "Publiés" },
  { value: "brouillon", label: "Brouillons" },
  { value: "archive", label: "Archivés" },
];
const VIDES: Record<FiltreLivres, string> = {
  tous: "Aucun livre",
  publie: "Aucun livre publié",
  brouillon: "Aucun brouillon",
  archive: "Aucun livre archivé",
};

export const estFiltreLivres = (v: unknown): v is FiltreLivres => FILTRES.some((f) => f.value === v);

const chiffre = (n: number) => n.toLocaleString("fr-FR");

/**
 * La page Bibliothèque du back-office, au style des pages Formations et Formateurs : les chiffres clés (livres publiés,
 * brouillons, lectures, téléchargements), le filtre par état, puis une carte par livre.
 */
export function VueBibliotheque({ donnees, filtreInitial = "tous" }: { donnees: BibliothequeAdmin; filtreInitial?: FiltreLivres }) {
  const [filtre, setFiltre] = useState<FiltreLivres>(filtreInitial);
  const { totaux, livres } = donnees;
  if (livres.length === 0) {
    return (
      <EmptyState
        icon={LibraryIcon}
        title="Aucun livre pour le moment"
        description="Ajoutez un livre : il naît en brouillon, visible seulement par l’équipe, jusqu’à sa publication."
      />
    );
  }
  const affiches = filtre === "tous" ? livres : livres.filter((l) => l.statut === filtre);
  return (
    <div className="flex flex-col gap-6 max-sm:gap-5">
      <div className={GRILLE_CHIFFRES}>
        <Tuile icon={LibraryIcon} tone="reussite" label="Livres publiés" value={chiffre(totaux.publies)} />
        <Tuile icon={PencilEdit02Icon} label="Brouillons" value={chiffre(totaux.brouillons)} />
        <Tuile icon={BookOpen02Icon} tone="information" label="Lectures" value={chiffre(totaux.lectures)} />
        <Tuile icon={Download04Icon} tone="attention" label="Téléchargements" value={chiffre(totaux.telechargements)} />
      </div>
      <FilterChips label="Filtrer les livres" options={FILTRES} value={filtre} onValueChange={(v) => setFiltre(estFiltreLivres(v) ? v : "tous")} />
      {affiches.length === 0 ? (
        <EmptyState icon={LibraryIcon} title={VIDES[filtre]} description="Choisissez un autre filtre, ou « Tous »." />
      ) : (
        <GrilleLivres livres={affiches} />
      )}
    </div>
  );
}
