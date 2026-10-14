"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMaintenant } from "@/components/notifications/horloge";
import type { MoiCommunaute, PublicationDetail } from "@/lib/communaute/types";
import { CartePublication } from "./CartePublication";

/** La publication et tous ses commentaires ; supprimée, retour à l'Accueil ; un lien de commentaire y mène. */
export function DetailPublication({ publication, moi, maintenant: heureServeur }: { publication: PublicationDetail; moi: MoiCommunaute; maintenant?: string }) {
  const router = useRouter();
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
      onSupprimee={() => router.push("/accueil")}
    />
  );
}
