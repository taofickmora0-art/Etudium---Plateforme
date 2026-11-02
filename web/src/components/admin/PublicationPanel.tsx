"use client";

import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/Button";
import type { FormationAdmin } from "@/lib/admin/types";
import type { StatutFormation } from "@/lib/contenus/libelles";
import { dateCourte } from "@/lib/utilisateurs/regles";
import { ModificationsNonPubliees } from "@/components/editeur/ModificationsNonPubliees";
import { actionsFormation, FenetresFormation, LIBELLES_ACTIONS, type ActionFormation, type FenetreFormation } from "./formations/ActionsFormation";

/** L'allure de chaque bouton : l'action principale en bleu, les retraits en contour, les actions graves en rouge doux. */
const VARIANTES: Record<ActionFormation, ComponentProps<typeof Button>["variant"]> = {
  publier: "principal",
  renvoyer: "contour",
  archiver: "contour",
  desactiver: "dangerDoux",
  reactiver: "principal",
  republier: "principal",
  supprimer: "dangerDoux",
};

const EXPLICATION: Record<StatutFormation, string> = {
  brouillon: "Brouillon : visible seulement par l’équipe et par son formateur.",
  publiee: "Publiée : visible dans le catalogue.",
  archivee: "Archivée : retirée du catalogue. Rien n’est supprimé.",
  desactivee: "Désactivée : plus aucun accès pour les étudiants. Leur progression, leurs certificats et leurs avis sont gardés.",
};

type Props = {
  id: string;
  formation: Pick<FormationAdmin, "statut" | "etat" | "envoyeeLe" | "renvoyeeLe" | "remarqueRelecture" | "modifieeParFormateurLe" | "publieeLe" | "modificationsNonPubliees">;
  /** Nom de la fiche formateur de la formation, ou null. */
  formateurNom: string | null;
  /** La version en ligne (0057) : « Version 8 · aujourd’hui » ; null sans historique. */
  version?: string | null;
  /** Le nombre d'étudiants qui suivent la formation (0059), pour la fenêtre « Désactiver » ; null s'il n'est pas lu. */
  suiveurs?: number | null;
};

/** Ce que l'équipe doit savoir de la relecture (spec de l'espace formateur, §4). */
function EtatRelecture({ formation, formateurNom }: Omit<Props, "id" | "version" | "suiveurs">) {
  if (formation.etat === "en_attente" && formation.envoyeeLe) {
    return (
      <p className="m-0 text-[15px] leading-6 font-medium text-encre">
        {`Envoyée en relecture le ${dateCourte(formation.envoyeeLe)}${formateurNom ? ` par ${formateurNom}` : ""}`}
      </p>
    );
  }
  if (formation.etat === "a_corriger" && formation.renvoyeeLe) {
    return (
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[15px] leading-6 font-medium text-encre">{`Renvoyée au formateur le ${dateCourte(formation.renvoyeeLe)}`}</p>
        {formation.remarqueRelecture && <p className="m-0 text-sm leading-[22px] break-words whitespace-pre-line text-discret">{formation.remarqueRelecture}</p>}
      </div>
    );
  }
  if (formation.statut === "publiee" && formation.modifieeParFormateurLe) {
    return <p className="m-0 text-sm leading-[22px] text-discret">{`Modifiée par le formateur le ${dateCourte(formation.modifieeParFormateurLe)}`}</p>;
  }
  return null;
}

/**
 * Onglet « Publication » : publier, archiver, republier, renvoyer au formateur, supprimer un brouillon (spec du lot 1,
 * §10) ; désactiver ou réactiver une formation publiée (lot 5, étape C). Les règles et les fenêtres sont celles du menu
 * ⋮ des cartes de la liste (ActionsFormation).
 */
export function PublicationPanel({ id, formation, formateurNom, version = null, suiveurs = null }: Props) {
  const { statut } = formation;
  const [fenetre, setFenetre] = useState<FenetreFormation>(null);

  return (
    <div className="flex max-w-[680px] flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6">
      {formation.modificationsNonPubliees && <ModificationsNonPubliees formationId={id} />}
      <EtatRelecture formation={formation} formateurNom={formateurNom} />
      <p className="m-0 text-[15px] leading-6 text-texte">{EXPLICATION[statut]}</p>
      {version && <p className="m-0 text-sm leading-[22px] text-discret">{version}</p>}
      <div className="flex flex-wrap gap-2">
        {actionsFormation(formation).map((action) => (
          <Button key={action} variant={VARIANTES[action]} onClick={() => setFenetre(action)}>
            {LIBELLES_ACTIONS[action]}
          </Button>
        ))}
      </div>
      <FenetresFormation id={id} statut={statut} suiveurs={suiveurs} fenetre={fenetre} onFenetreChange={setFenetre} />
    </div>
  );
}
