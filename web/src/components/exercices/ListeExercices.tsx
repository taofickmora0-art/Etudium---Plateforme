"use client";

import { useState } from "react";
import Link from "next/link";
import { AssignmentsIcon } from "@hugeicons/core-free-icons";
import { adresseLecon } from "@/components/catalogue/ProgrammeFiche";
import { Button, buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Tag } from "@/components/ui/Tag";
import { moment } from "@/lib/communaute/regles";
import { LIBELLES_STATUT, type ExerciceListe, type StatutRendu } from "@/lib/exercices/types";
import { TONS_STATUT } from "./HistoriqueRendus";

type Filtre = "tous" | StatutRendu;
const FILTRES: { value: Filtre; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "a_corriger", label: "À corriger" },
  { value: "en_attente", label: "En attente" },
  { value: "valide", label: "Validés" },
];
const VIDES: Record<StatutRendu, { titre: string; texte: string }> = {
  a_corriger: { titre: "Aucun exercice à corriger", texte: "Quand votre formateur demande une correction, l’exercice s’affiche ici avec sa remarque." },
  en_attente: { titre: "Aucun exercice en attente", texte: "Après un dépôt, votre travail reste ici jusqu’à sa correction par votre formateur." },
  valide: { titre: "Aucun exercice validé", texte: "Vos exercices validés s’afficheront ici." },
};
const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/**
 * La page « Exercices » (NdExercices) : les exercices où l'étudiant a rendu au moins une fois, le plus récent d'abord,
 * avec les filtres Tous · À corriger · En attente · Validés et la remarque du formateur sur ceux à corriger.
 */
export function ListeExercices({ exercices }: { exercices: ExerciceListe[] }) {
  const [filtre, setFiltre] = useState<Filtre>("tous");
  if (exercices.length === 0) {
    return (
      <EmptyState
        icon={AssignmentsIcon}
        title="Aucun exercice pour le moment"
        description="Les exercices de vos formations s’afficheront ici dès votre premier rendu."
        action={
          <Link href="/formations" className={buttonVariants({ variant: "contour" })}>
            Voir mes formations
          </Link>
        }
      />
    );
  }
  const visibles = filtre === "tous" ? exercices : exercices.filter((e) => e.statut === filtre);
  const maintenant = new Date();
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <FilterChips label="Filtrer les exercices" options={FILTRES} value={filtre} onValueChange={(v) => setFiltre(v as Filtre)} />
      {filtre !== "tous" && visibles.length === 0 ? (
        <EmptyState
          icon={AssignmentsIcon}
          title={VIDES[filtre].titre}
          description={VIDES[filtre].texte}
          action={
            <Button variant="contour" onClick={() => setFiltre("tous")}>
              Voir tous les exercices
            </Button>
          }
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {visibles.map((e) => {
            const adresse = adresseLecon(e.slug, e.leconId);
            // Un exercice simple n'a pas de dépôt : il est « terminé ».
            const quand = e.corrigeLe
              ? `Retour reçu ${moment(e.corrigeLe, maintenant)}`
              : `${e.genre === "simple" ? "Terminé" : "Déposé"} ${moment(e.creeLe, maintenant)}`;
            return (
              <article key={e.leconId} className="flex min-w-0 flex-col gap-3 rounded-carte border border-bordure-carte bg-panneau p-5 max-sm:p-4">
                <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <h2 className="m-0 text-base leading-6 font-semibold text-encre max-sm:text-[15px]">
                      <Link href={adresse} className="focus-etudium text-inherit no-underline hover:underline">
                        {e.titre}
                      </Link>
                    </h2>
                    <span className="text-[13px] leading-5 text-discret">{`${e.formation} · Module ${e.moduleRang}`}</span>
                  </div>
                  <span className="flex flex-none items-center gap-2.5">
                    <span className="text-[13px] leading-5 text-discret">{majuscule(quand)}</span>
                    <Tag tone={TONS_STATUT[e.statut]}>{LIBELLES_STATUT[e.statut]}</Tag>
                  </span>
                </div>
                {e.statut === "a_corriger" && (
                  <>
                    {e.remarque && (
                      <div className="flex flex-col gap-1 rounded-champ bg-page px-3.5 py-3">
                        <span className="text-[13px] leading-5 font-medium text-encre">{`Remarque de ${e.correcteur ?? "votre formateur"}`}</span>
                        <p className="m-0 text-sm leading-[22px] text-texte">{e.remarque}</p>
                      </div>
                    )}
                    <Link href={adresse} className={buttonVariants({ size: "sm" }) + " self-start"}>
                      Déposer une nouvelle version
                    </Link>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
