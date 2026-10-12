"use client";

import type { ReactNode } from "react";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

/** Les trois onglets d'une formation au back-office ; chacun garde sa saisie quand on passe à un autre. */
export function FormationOnglets({ informations, programme, publication }: { informations: ReactNode; programme: ReactNode; publication: ReactNode }) {
  return (
    <SegmentedTabs
      label="Parties de la formation"
      keepMounted
      items={[
        { value: "informations", label: "Informations", content: informations },
        { value: "programme", label: "Programme", content: programme },
        { value: "publication", label: "Publication", content: publication },
      ]}
    />
  );
}
