"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMaintenant } from "@/components/notifications/horloge";
import { CHEMINS_COMMUNAUTE, type EspaceCommunaute } from "@/lib/communaute/chemins";
import type { MoiCommunaute, PublicationDetail } from "@/lib/communaute/types";
import { CartePublication } from "./CartePublication";

/** La publication et tous ses commentaires ; supprimée, retour à l'Accueil ; un lien de commentaire y mène. */
export function DetailPublication({
  publication,
  moi,
  maintenant: heureServeur,
  espace = "etudiant",
}: {
  publication: PublicationDetail;
  moi: MoiCommunaute;
  maintenant?: string;
  espace?: EspaceCommunaute;
}) {
  const router = useRouter();
  const accueil = CHEMINS_COMMUNAUTE[espace].accueil;
  const maintenant = useMaintenant(heureServeur);
  // « Copier le lien » d'un commentaire : l'adresse finit par #commentaire-<id> ; la page descend jusqu'à lui.
  useEffect(() => {
    const cible = window.location.hash.slice(1);
    if (cible.startsWith("commentaire-")) document.getElementById(cible)?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <CartePublication
      publication={publication}
      toutesReponses={publication.toutesReponses}
      moi={moi}
      maintenant={maintenant}
      onSupprimee={() => router.push(accueil)}
      lienSession={CHEMINS_COMMUNAUTE[espace].evenements}
    />
  );
}
