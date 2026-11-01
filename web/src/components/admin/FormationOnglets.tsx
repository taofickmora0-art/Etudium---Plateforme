"use client";

import type { ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

/**
 * Les onglets d'une formation au back-office et dans l'espace formateur ; chacun garde sa saisie quand on passe à un
 * autre. « Apprenants » : refonte des formations, étape C ; « Historique » : fin du lot 4.
 */
export function FormationOnglets({
  informations,
  programme,
  publication,
  apprenants,
  historique,
  ongletInitial = "informations",
}: {
  informations: ReactNode;
  programme: ReactNode;
  publication: ReactNode;
  apprenants: ReactNode;
  /** L'historique des versions (fin du lot 4) : l'onglet n'apparaît qu'à partir de la première version. */
  historique?: ReactNode;
  /** « programme » au retour d'une leçon (?onglet=programme). */
  ongletInitial?: string;
}) {
  return (
    <SegmentedTabs
      label="Parties de la formation"
      keepMounted
      defaultValue={ongletInitial}
      items={[
        { value: "informations", label: "Informations", content: informations },
        // « Leçons », comme izimentor (refonte des formations, §3.1) ; l'adresse garde ?onglet=programme.
        { value: "programme", label: "Leçons", content: programme },
        { value: "publication", label: "Publication", content: publication },
        { value: "apprenants", label: "Apprenants", content: apprenants },
        ...(historique ? [{ value: "historique", label: "Historique", content: historique }] : []),
      ]}
    />
  );
}
