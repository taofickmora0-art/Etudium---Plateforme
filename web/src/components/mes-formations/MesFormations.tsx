"use client";

import { useState } from "react";
import Link from "next/link";
import { CourseIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { GRILLE_CARTES } from "@/components/ui/grilles";
import { Heading, Lead } from "@/components/ui/Text";
import type { FiltreMesFormations } from "@/lib/mes-formations/regles";
import { CarteSuivie, type VueCarteSuivie } from "./CarteSuivie";

const FILTRES: { value: FiltreMesFormations; label: string }[] = [
  { value: "toutes", label: "Toutes" },
  { value: "enCours", label: "En cours" },
  { value: "terminees", label: "Terminées" },
  { value: "verrouillees", label: "Verrouillées" },
  { value: "favoris", label: "Favoris" },
];

const VIDE: Record<FiltreMesFormations, string> = {
  toutes: "",
  enCours: "Aucune formation en cours.",
  terminees: "Aucune formation terminée pour le moment.",
  verrouillees: "Aucune formation verrouillée.",
  favoris: "Aucun favori parmi vos formations.",
};

const garder: Record<FiltreMesFormations, (v: VueCarteSuivie) => boolean> = {
  toutes: () => true,
  enCours: (v) => v.etat === "enCours",
  terminees: (v) => v.etat === "terminee",
  verrouillees: (v) => v.etat === "verrouillee",
  favoris: (v) => v.favori,
};


/** Mes formations (NdMesFormations, NdMobFormations) : les formations commencées, de la plus récente à la plus ancienne. */
export function MesFormations({ suivies }: { suivies: VueCarteSuivie[] }) {
  const [filtre, setFiltre] = useState<FiltreMesFormations>("toutes");
  const visibles = suivies.filter(garder[filtre]);
  return (
    <div className="flex flex-col">
      <div className="min-w-0">
        <Heading level="page">Mes formations</Heading>
        <Lead className="mt-2.5">Les formations que vous avez commencées, de la plus récente à la plus ancienne.</Lead>
      </div>
      {suivies.length === 0 ? (
        <>
          <div aria-hidden="true" className="mt-5 h-px bg-separateur" />
          <EmptyState
            className="mt-8"
            icon={CourseIcon}
            title="Aucune formation commencée"
            description="Choisissez une formation gratuite pour commencer, ou parcourez le catalogue."
            action={
              <Button asChild>
                <Link href="/formations">Parcourir le catalogue</Link>
              </Button>
            }
          />
        </>
      ) : (
        <>
          <FilterChips
            label="Filtrer mes formations"
            options={FILTRES}
            value={filtre}
            onValueChange={(v) => setFiltre(v as FiltreMesFormations)}
            className="mt-[21px] max-sm:-mx-4 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-4 max-sm:[scrollbar-width:none] max-sm:[&>button]:flex-none"
          />
          <div aria-hidden="true" className="mt-5 h-px bg-separateur" />
          <div className="mt-8">
            {visibles.length === 0 ? (
              <p className="m-0 text-sm leading-[22px] text-discret">{VIDE[filtre]}</p>
            ) : (
              <div className={GRILLE_CARTES}>
                {visibles.map((vue) => (
                  <CarteSuivie key={vue.id} vue={vue} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
