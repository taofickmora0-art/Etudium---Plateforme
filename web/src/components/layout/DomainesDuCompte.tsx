"use client";

import { useEffect } from "react";
import { fixerDomaines } from "@/lib/auth/domaines-du-compte";
import type { Domaine } from "@/lib/auth/domaines";

/** Transmet au menu du back-office les domaines du compte, dès que l'en-tête l'a lu (lot 6 A). */
export function DomainesDuCompte({ domaines }: { domaines: Domaine[] }) {
  const cle = domaines.join(",");
  useEffect(() => {
    fixerDomaines(cle ? (cle.split(",") as Domaine[]) : []);
  }, [cle]);
  return null;
}
