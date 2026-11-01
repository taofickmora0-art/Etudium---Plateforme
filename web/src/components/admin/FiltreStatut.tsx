"use client";

import { useRouter } from "next/navigation";
import { FilterChips } from "@/components/ui/FilterChips";

const OPTIONS = [
  { value: "toutes", label: "Toutes" },
  { value: "en_attente", label: "En attente" },
  { value: "brouillon", label: "Brouillons" },
  { value: "publiee", label: "Publiées" },
  { value: "desactivee", label: "Désactivées" },
  { value: "archivee", label: "Archivées" },
];

/** Filtre de la liste des formations, gardé dans l'adresse (?statut=…) pour survivre au rechargement. */
export function FiltreStatut({ valeur }: { valeur: string }) {
  const router = useRouter();
  return (
    <FilterChips
      label="Filtrer les formations"
      options={OPTIONS}
      value={valeur}
      onValueChange={(v) => router.replace(v === "toutes" ? "/admin/formations" : `/admin/formations?statut=${v}`, { scroll: false })}
    />
  );
}
