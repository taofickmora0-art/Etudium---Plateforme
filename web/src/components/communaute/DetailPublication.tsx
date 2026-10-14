"use client";

import { useRouter } from "next/navigation";
import { useMaintenant } from "@/components/notifications/horloge";
import type { MoiCommunaute, PublicationDetail } from "@/lib/communaute/types";
import { CartePublication } from "./CartePublication";

/** La publication et toutes ses réponses ; supprimée, retour à la Communauté. */
export function DetailPublication({ publication, moi, maintenant: heureServeur }: { publication: PublicationDetail; moi: MoiCommunaute; maintenant?: string }) {
  const router = useRouter();
  const maintenant = useMaintenant(heureServeur);
  return (
    <CartePublication
      publication={publication}
      toutesReponses={publication.toutesReponses}
      moi={moi}
      maintenant={maintenant}
      onSupprimee={() => router.push("/communaute")}
    />
  );
}
