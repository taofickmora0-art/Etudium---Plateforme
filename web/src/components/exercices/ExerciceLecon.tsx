"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { terminerExercice } from "@/lib/exercices/actions";
import { LIBELLES_STATUT, type ExerciceEtudiant } from "@/lib/exercices/types";
import { DepotTravail } from "./DepotTravail";
import { HistoriqueRendus, TONS_STATUT } from "./HistoriqueRendus";

const CARTE = "flex min-w-0 flex-col gap-5 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:gap-4 max-sm:p-4";
const ECHEC = "L’exercice n’a pas pu être marqué comme terminé. Réessayez.";

/**
 * L'exercice dans la page leçon (lot 3, spec §3 ; NdExercice) : un exercice simple se marque comme terminé ; un exercice
 * avec rendu montre son statut, le dépôt (s'il est permis) et l'historique des versions. Rien ne se débloque ensuite.
 */
export function ExerciceLecon({ leconId, exercice }: { leconId: string; exercice: ExerciceEtudiant }) {
  const router = useRouter();
  const { toast } = useToast();
  const [termine, setTermine] = useState(exercice.statut === "valide");
  const [enCours, demarrer] = useTransition();
  // Le bouton ou la zone de dépôt disparaît (terminé, envoyé, corrigé) : le focus passe à l'état de l'exercice.
  const etatTermine = useRef<HTMLParagraphElement>(null);
  const titre = useRef<HTMLHeadingElement>(null);
  const vu = useRef({ termine, statut: exercice.statut });
  useEffect(() => {
    if (termine && !vu.current.termine) etatTermine.current?.focus();
    else if (exercice.statut !== vu.current.statut) titre.current?.focus();
    vu.current = { termine, statut: exercice.statut };
  }, [termine, exercice.statut]);

  if (exercice.genre === "simple") {
    return (
      <section aria-label="Votre exercice" className={CARTE}>
        {termine ? (
          <p ref={etatTermine} tabIndex={-1} className="m-0 flex items-center gap-2 text-[15px] leading-[22px] font-medium text-reussite-texte outline-none">
            <Icon icon={CheckmarkCircle02Icon} size={20} />
            Exercice terminé
          </p>
        ) : (
          <>
            <p className="m-0 text-sm leading-[22px] text-texte">Faites l’exercice en suivant la consigne, puis marquez-le comme terminé.</p>
            <Button
              loading={enCours}
              onClick={() =>
                demarrer(async () => {
                  const reponse = await terminerExercice(leconId).catch(() => ({ ok: false as const, message: ECHEC }));
                  if (!reponse.ok) return toast({ tone: "erreur", title: reponse.message });
                  setTermine(true);
                  toast({ tone: "reussite", title: "Exercice marqué comme terminé" });
                  router.refresh();
                })
              }
              className="self-start max-sm:w-full"
            >
              Marquer comme terminé
            </Button>
          </>
        )}
      </section>
    );
  }

  const { statut } = exercice;
  return (
    <section aria-label="Votre travail" className={CARTE}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 ref={titre} tabIndex={-1} className="m-0 text-lg leading-7 font-semibold text-encre outline-none max-sm:text-base">
          Votre travail
        </h2>
        {statut && <Tag tone={TONS_STATUT[statut]}>{LIBELLES_STATUT[statut]}</Tag>}
      </div>
      {statut === "en_attente" && <Banner tone="information" title="Votre travail attend sa correction. Vous recevrez une notification dès qu’il sera corrigé." />}
      {statut === "a_corriger" && (
        <Banner tone="attention" title="Une correction est demandée">
          Lisez la remarque de votre formateur dans l’historique, puis déposez une nouvelle version.
        </Banner>
      )}
      {statut === "valide" && <Banner tone="reussite" title="Exercice validé" />}
      {exercice.peutDeposer && <DepotTravail leconId={leconId} nouvelleVersion={statut === "a_corriger"} onEnvoye={() => router.refresh()} />}
      {exercice.versions.length > 0 && <HistoriqueRendus versions={exercice.versions} />}
    </section>
  );
}
